import { supabase } from './supabaseClient';
import Papa from 'papaparse';
import { startOfYear, endOfYear, subYears } from 'date-fns';

export const getStatusHistory = async (inventoryId) => {
  const { data, error } = await supabase
    .from('status_history_view')
    .select('*')
    .eq('inventory_id', inventoryId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }

  return data; // Returns id, notes, status_name, updater_name, etc.
};

export const updateInventoryStatus = async (inventoryId, statusId, userId, notes = '') => {
  if (!inventoryId || !statusId || !userId) return { error: 'Missing data' };

  const { data, error } = await supabase
    .from('status_changes')
    .insert([{
      inventory_id: inventoryId,
      status_id: statusId,
      updated_by: userId,
      notes: notes
    }])
    .select();

  return { data, error };
};

export const exportInventoryByDate = async ({ filterType, customRange }) => {
  let startDate, endDate;
  const now = new Date();

  // 1. Determine Date Range
  if (filterType === 'currentYear') {
    startDate = startOfYear(now);
    endDate = endOfYear(now);
  } else if (filterType === 'lastYear') {
    const lastYear = subYears(now, 1);
    startDate = startOfYear(lastYear);
    endDate = endOfYear(lastYear);
  } else if (filterType === 'custom') {
    if (customRange && customRange.from) {
      startDate = customRange.from;
      endDate = customRange.to || customRange.from; // Handle single day selection
    }
  }

  if (!startDate || !endDate) {
    throw new Error("Invalid date range selected for export.");
  }

  // 2. Fetch Data from Supabase
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('inventory')
    .select(`
      id,
      produced,
      tag,
      product_name,
      species_name,
      boardfeet,
      quantity,
      inventory_value,
      sales_value,
      invoice_number,
      line,
      length,
      width,
      rows,
      note,
      weight,
      tagger
    `)
    .gte('produced', startDate.toISOString())
    .lte('produced', endDate.toISOString());

  if (inventoryError) throw inventoryError;
  if (!inventoryData || inventoryData.length === 0) {
    alert("No data found for the selected date range.");
    return;
  }

  // 3. Fetch Profiles separately
  const taggerIds = [...new Set(inventoryData.map(item => item.tagger).filter(Boolean))];
  let taggerMap = {};
  if (taggerIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', taggerIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    } else {
      taggerMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = profile.full_name;
        return acc;
      }, {});
    }
  }

  // 4. Flatten the data and Convert to CSV and Download
  const flattenedData = inventoryData.map(item => ({
    ...item,
    product_name: item.product_name || '',
    species_name: item.species_name || '',
    tagger_name: item.tagger ? taggerMap[item.tagger] : ''
  }));

  const csv = Papa.unparse(flattenedData, {
    columns: [
      'id', 'produced', 'tag', 'product_name', 'species_name',
      'boardfeet', 'quantity', 'inventory_value', 'sales_value',
      'invoice_number', 'line', 'length', 'width', 'rows', 'note',
      'weight', 'tagger_name'
    ]
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', `inventory-export-${filterType}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};