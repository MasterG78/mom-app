import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import StatusHistoryModal from './StatusHistoryModal';
import { pdf } from '@react-pdf/renderer';
import { InventoryTagPDF } from './InventoryTag';
import QRCode from 'qrcode';
import { saveAs } from 'file-saver';
import PrintTagModal from './PrintTagModal';

export default function InventoryReport() {
  const [reportData, setReportData] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [printingTagData, setPrintingTagData] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // --- Filters ---
  const [sortBy, setSortBy] = useState('date');
  const [lineFilter, setLineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRange, setDateRange] = useState('This Week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // 1. Fetch Status Options
      const { data: statusList } = await supabase
        .from('statuses')
        .select('status_name')
        .order('status_name');
      setStatusOptions(statusList || []);

      // 2. Fetch the Report View (paginated to bypass 1000-row PostgREST limit)
      let allData = [];
      let from = 0;
      const pageSize = 1000;
      let fetchError = null;

      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('inventory_report_view')
          .select('*')
          .order('produced', { ascending: false })
          .range(from, from + pageSize - 1);

        if (pageError) {
          fetchError = pageError;
          break;
        }

        allData = allData.concat(page || []);

        if (!page || page.length < pageSize) break;
        from += pageSize;
      }

      if (fetchError) {
        console.error('Error fetching view:', fetchError);
        alert('Error loading report view.');
      } else {
        setReportData(allData);
      }

      // 3. Fetch Active System Alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      
      if (!alertsError) {
        setAlerts(alertsData || []);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  const handleRowClick = (entry) => {
    // Don't open modal for non-data rows
    if (entry.isSubtotal || entry.isGrandTotal) return;
    setSelectedEntry(entry);
  };

  const handleCloseModal = () => {
    setSelectedEntry(null);
  };

  const handlePrintTag = (row, e) => {
    e.stopPropagation();
    setPrintingTagData(row);
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { error } = await supabase
        .from('system_alerts')
        .update({
          resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      // Remove from UI
      setAlerts(prevAlerts => prevAlerts.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert('Failed to acknowledge alert.');
    }
  };

  const processedReport = useMemo(() => {
    let data = [...reportData];

    // 1. Status Filter
    if (statusFilter !== 'All') {
      data = data.filter(item => item.current_status === statusFilter);
    }

    // 2. Line Filter
    if (lineFilter !== 'All') {
      data = data.filter(item => item.line === lineFilter);
    }

    // 3. Date Range Filter
    const now = new Date();
    const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    data = data.filter(item => {
      if (!item.produced) return false;

      // Parse the 'YYYY-MM-DD' part to avoid timezone shifts during filtering
      const datePart = item.produced.split('T')[0];
      const [year, month, dayNum] = datePart.split('-').map(Number);
      const prodDate = new Date(year, month - 1, dayNum);

      if (dateRange === 'This Week') {
        const sunday = new Date(now);
        sunday.setDate(now.getDate() - now.getDay());
        const startOfSun = getStartOfDay(sunday);
        return prodDate >= startOfSun;
      }
      if (dateRange === 'Last Week') {
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - now.getDay() - 7);
        const thisSunday = new Date(now);
        thisSunday.setDate(now.getDate() - now.getDay());
        return prodDate >= getStartOfDay(lastSunday) && prodDate < getStartOfDay(thisSunday);
      }
      if (dateRange === '30') {
        const limit = new Date(); limit.setDate(now.getDate() - 30);
        return prodDate >= getStartOfDay(limit);
      }
      if (dateRange === '60') {
        const limit = new Date(); limit.setDate(now.getDate() - 60);
        return prodDate >= getStartOfDay(limit);
      }
      if (dateRange === '90') {
        const limit = new Date(); limit.setDate(now.getDate() - 90);
        return prodDate >= getStartOfDay(limit);
      }
      if (dateRange === 'Custom' && customStart && customEnd) {
        return prodDate >= new Date(customStart) && prodDate <= new Date(customEnd + 'T23:59:59');
      }
      return true;
    });

    // 4. Sort & Subtotal Logic
    if (sortBy === 'date') {
      data.sort((a, b) => {
        // Sort by Date (Day only) Descending
        const datePartA = a.produced.split('T')[0];
        const datePartB = b.produced.split('T')[0];

        if (datePartA !== datePartB) {
          return datePartB.localeCompare(datePartA);
        }
        // Secondary sort by Tag (Numeric) Descending
        return (b.tag || '').toString().localeCompare((a.tag || '').toString(), undefined, { numeric: true });
      });

      let gTotalVal = 0, gTotalBf = 0, gTotalQty = 0, gTotalPrice = 0;
      data.forEach(item => {
        gTotalVal += parseFloat(item.total_value) || 0;
        gTotalBf += parseFloat(item.boardfeet) || 0;
        gTotalQty += parseFloat(item.quantity) || 0;
        gTotalPrice += parseFloat(item.sales_value) || 0;
      });

      if (data.length > 0) {
        data.push({
          isGrandTotal: true,
          label: 'GRAND TOTAL',
          value: gTotalVal,
          bf: gTotalBf,
          qty: gTotalQty,
          price: gTotalPrice
        });
      }
      return data;
    }

    if (sortBy === 'product') {
      data.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));

      const result = [];
      let currentProduct = null;

      // Accumulators for Subtotals
      let pSubVal = 0, pSubBf = 0, pSubQty = 0, pSubPrice = 0;
      // Accumulators for Grand Totals
      let gTotalVal = 0, gTotalBf = 0, gTotalQty = 0, gTotalPrice = 0;

      data.forEach((item, index) => {
        const val = parseFloat(item.total_value) || 0;
        const bf = parseFloat(item.boardfeet) || 0;
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.sales_value) || 0;

        // If product changes, push the subtotal row
        if (currentProduct && item.product_name !== currentProduct) {
          result.push({
            isSubtotal: true,
            label: `${currentProduct} Subtotal`,
            value: pSubVal,
            bf: pSubBf,
            qty: pSubQty,
            price: pSubPrice
          });
          // Reset Subtotals
          pSubVal = 0; pSubBf = 0; pSubQty = 0; pSubPrice = 0;
        }

        result.push(item);
        currentProduct = item.product_name;

        // Add to totals
        pSubVal += val; pSubBf += bf; pSubQty += qty; pSubPrice += price;
        gTotalVal += val; gTotalBf += bf; gTotalQty += qty; gTotalPrice += price;

        // If last item, push final subtotal and Grand Total
        if (index === data.length - 1) {
          result.push({
            isSubtotal: true,
            label: `${currentProduct} Subtotal`,
            value: pSubVal,
            bf: pSubBf,
            qty: pSubQty,
            price: pSubPrice
          });
          result.push({
            isGrandTotal: true,
            label: 'GRAND TOTAL',
            value: gTotalVal,
            bf: gTotalBf,
            qty: gTotalQty,
            price: gTotalPrice
          });
        }
      });
      return result;
    }

    return data;
  }, [reportData, sortBy, lineFilter, statusFilter, dateRange, customStart, customEnd]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Use the calendar day part to avoid timezone shifts
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${month}/${day}/${year}`;
  };

  const reportStyles = `
    @media print { .no-print { display: none !important; } }
    .report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .report-table th { border-bottom: 2px solid #333; text-align: left; padding: 4px; }
    .report-table td { padding: 3px 4px; border-bottom: 1px solid #eee; }
    .subtotal-row { background-color: #f8f9fa; font-weight: bold; border-top: 1px solid #ccc; }
    .grand-total-row { background-color: #e9ecef; font-weight: 900; font-size: 13px; border-top: 2px solid #000; }
    .filter-group { display: flex; flexDirection: column; gap: 2px; }
    .filter-label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; }
  `;

  if (loading) return <div style={{ padding: '20px' }}>Loading Report View...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff' }}>
      <style>{reportStyles}</style>

      <div className="no-print" style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ marginBottom: '15px' }}>Inventory Evaluation Report</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>

          <div className="filter-group">
            <label className="filter-label">Line</label>
            <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} style={{ padding: '5px' }}>
              <option value="All">All Lines</option>
              {['A', 'B', 'C', 'D', 'P', 'R'].map(l => <option key={l} value={l}>Line {l}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '5px' }}>
              <option value="All">All Statuses</option>
              {statusOptions.map(s => (
                <option key={s.status_name} value={s.status_name}>{s.status_name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Timeframe</label>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '5px' }}>
              <option value="This Week">This Week</option>
              <option value="Last Week">Last Week</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="All">All Time</option>
              <option value="Custom">Custom Range</option>
            </select>
          </div>

          {dateRange === 'Custom' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Start</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '4px' }} />
              </div>
              <div className="filter-group">
                <label className="filter-label">End</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '4px' }} />
              </div>
            </>
          )}

          <div className="filter-group">
            <label className="filter-label">Sort</label>
            <select 
              value={sortBy} 
              onChange={(e) => {
                const newSort = e.target.value;
                setSortBy(newSort);
                setStatusFilter(newSort === 'product' ? 'In Stock' : 'All');
              }} 
              style={{ padding: '5px' }}
            >
              <option value="date">Date</option>
              <option value="product">Product (Subtotaled)</option>
            </select>
          </div>

          <button onClick={() => window.print()} style={{ padding: '6px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Print Report
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="no-print" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '5px', color: '#856404' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px' }}>⚠️ System Alerts ({alerts.length})</h3>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
            {alerts.map(alert => (
              <li key={alert.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #ffd579' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>{alert.title}</strong>
                  <span>{alert.message}</span>
                  {alert.target_role && <span style={{ marginLeft: '10px', fontSize: '10px', backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '10px', color: '#495057' }}>Role: {alert.target_role}</span>}
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  style={{ padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  Acknowledge
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <table className="report-table">
        <thead>
          <tr>
            <th>Tag #</th>
            {sortBy !== 'date' && <th>Invoice #</th>}
            <th>Date</th>
            <th>Line</th>
            <th>Product Name</th>
            {/* Species is hidden per your view definition not including it yet */}
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Qty (Pcs)</th>
            <th style={{ textAlign: 'right' }}>Board Feet</th>
            <th style={{ textAlign: 'right' }}>Price ($)</th>
            <th style={{ textAlign: 'right' }}>Inv. Value ($)</th>
            {sortBy === 'date' && <th>Invoice #</th>}
            {sortBy === 'date' && <th>Customer</th>}
            <th className="no-print" style={{ width: '60px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {processedReport.length > 0 ? processedReport.map((row, idx) => {
            // --- Grand Total Row ---
            if (row.isGrandTotal) return (
              <tr key="grand" className="grand-total-row">
                <td colSpan={sortBy === 'date' ? 5 : 6} style={{ textAlign: 'right' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>{sortBy !== 'date' && row.qty > 0 ? row.qty.toLocaleString() : '-'}</td>
                <td style={{ textAlign: 'right' }}>{sortBy !== 'date' && row.bf > 0 ? row.bf.toLocaleString() : '-'}</td>
                <td style={{ textAlign: 'right' }}>{sortBy !== 'date' && row.price > 0 ? '$' + row.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                <td style={{ textAlign: 'right' }}>${row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                {sortBy === 'date' && <td></td>}
                {sortBy === 'date' && <td></td>}
                <td className="no-print"></td>
              </tr>
            );
            // --- Subtotal Row ---
            if (row.isSubtotal) return (
              <tr key={`sub-${idx}`} className="subtotal-row">
                <td colSpan={sortBy === 'date' ? 5 : 6} style={{ textAlign: 'right' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>{row.qty > 0 ? row.qty.toLocaleString() : '-'}</td>
                <td style={{ textAlign: 'right' }}>{row.bf > 0 ? row.bf.toLocaleString() : '-'}</td>
                <td style={{ textAlign: 'right' }}>${row.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{ textAlign: 'right' }}>${row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                {sortBy === 'date' && <td></td>}
                {sortBy === 'date' && <td></td>}
                <td className="no-print"></td>
              </tr>
            );
            // --- Standard Data Row ---
            return (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                style={{
                  backgroundColor: idx % 2 === 0 ? 'transparent' : '#fcfcfc',
                  cursor: 'pointer'
                }}
              >
                <td>{row.tag}</td>
                {sortBy !== 'date' && <td>{row.invoice_number || '-'}</td>}
                <td>{formatDate(row.produced)}</td>
                <td>{row.line}</td>
                <td>{row.product_name}</td>
                <td>{row.current_status || '-'}</td>
                {/* Two Columns: Only display the value if it exists */}
                <td style={{ textAlign: 'right' }}>{row.quantity ? row.quantity.toLocaleString() : '-'}</td>
                <td style={{ textAlign: 'right' }}>{row.boardfeet ? row.boardfeet.toLocaleString() : '-'}</td>
                <td style={{ textAlign: 'right' }}>{row.sales_value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{ textAlign: 'right' }}>{row.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                {sortBy === 'date' && <td>{row.invoice_number || '-'}</td>}
                {sortBy === 'date' && <td>{row.customer_name || '-'}</td>}
                <td className='no-print' onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handlePrintTag(row, e)}
                    style={{
                      textDecoration: 'none',
                      padding: '3px 6px',
                      color: '#007bff',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      fontSize: '10px',
                      background: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Print Tag
                  </button>
                </td>
              </tr>
            );
          }) : (
            <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>No inventory records found for these filters.</td></tr>
          )}
        </tbody>
      </table>

      {selectedEntry && (
        <StatusHistoryModal
          inventoryId={selectedEntry.id}
          tag={selectedEntry.tag}
          onClose={handleCloseModal}
        />
      )}
      {printingTagData && (
        <PrintTagModal
          data={printingTagData}
          mode="report"
          onClose={() => setPrintingTagData(null)}
        />
      )}
    </div>
  );
}
