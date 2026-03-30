import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { pdf } from '@react-pdf/renderer';
import { InventoryTagPDF } from './InventoryTag';
import QRCode from 'qrcode';

export default function InventoryManager({ isTest, session }) {
  const [searchTag, setSearchTag] = useState('');
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [species, setSpecies] = useState([]);
  const [statuses, setStatuses] = useState([]);
  
  const [formData, setFormData] = useState({
    product_id: '',
    species_id: '',
    boardfeet: '',
    quantity: '',
    inventory_value: '',
    sales_value: '',
    customer_name: '',
    note: '',
    status_id: ''
  });

  // 1. Load Products & Species for dropdowns
  useEffect(() => {
    async function loadResources() {
      const { data: p } = await supabase.from('products').select('*').order('product_name');
      const { data: s } = await supabase.from('species').select('*').order('species_name');
      const { data: st } = await supabase.from('statuses').select('*').order('status_name');
      setProducts(p || []);
      setSpecies(s || []);
      setStatuses(st || []);
    }
    loadResources();
  }, []);

  // 2. Search for Tag
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchTag) return;
    
    setLoading(true);
    setBundle(null);
    
    try {
      const { data, error } = await supabase
        .from('inventory_view')
        .select('*')
        .eq('tag', searchTag)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') alert('Tag not found.');
        else throw error;
      } else {
        setBundle(data);
        setFormData({
          product_id: data.product_id || '',
          species_id: data.species_id || '',
          boardfeet: data.boardfeet || '',
          quantity: data.quantity || '',
          inventory_value: data.inventory_value ? parseFloat(data.inventory_value).toFixed(2) : '',
          sales_value: data.sales_value ? parseFloat(data.sales_value).toFixed(2) : '',
          customer_name: data.customer_name || '',
          note: data.note || '',
          status_id: data.status_id || ''
        });
      }
    } catch (err) {
      alert('Search Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Field Changes & Recalculations
  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    // if BoardFeet or Quantity changes, suggest new values based on existing snapshot costs
    if (bundle && (name === 'boardfeet' || name === 'quantity')) {
      const val = parseFloat(value) || 0;
      const unitCost = bundle.unit_inv_value || 0;
      const unitPrice = bundle.unit_product_value || 0;
      
      if (bundle.unit_type === 'Bd Ft' && name === 'boardfeet') {
        newFormData.inventory_value = (val * unitCost).toFixed(2);
        newFormData.sales_value = (val * unitPrice).toFixed(2);
      } else if (bundle.unit_type === 'Each' && name === 'quantity') {
        newFormData.inventory_value = (val * unitCost).toFixed(2);
        newFormData.sales_value = (val * unitPrice).toFixed(2);
      }
    }
    
    setFormData(newFormData);
  };

  // 4. Save Adjustment
  const handleSave = async (print = false) => {
    if (!bundle) return;
    setSaving(true);
    
    try {
      // Determine if product/species changed to update snapshots
      let updatedSnapshot = {};
      if (formData.product_id !== bundle.product_id) {
        const newProd = products.find(p => p.id == formData.product_id);
        if (newProd) {
          updatedSnapshot = {
            product_name: newProd.product_name,
            unit_type: newProd.unit_type,
            thickness: newProd.thickness,
            unit_inv_value: newProd.unit_inv_value,
            unit_product_value: newProd.unit_product_value
          };
        }
      }
      if (formData.species_id !== bundle.species_id) {
        const newSpec = species.find(s => s.id == formData.species_id);
        updatedSnapshot.species_name = newSpec?.species_name || null;
      }

      // Create update payload excluding status_id since it's not in the inventory table
      const { status_id, ...baseFormData } = formData;
      const updatePayload = {
        ...baseFormData,
        ...updatedSnapshot,
        boardfeet: parseFloat(formData.boardfeet) || 0,
        quantity: parseInt(formData.quantity) || 0,
        inventory_value: parseFloat(formData.inventory_value) || 0,
        sales_value: parseFloat(formData.sales_value) || 0,
        product_id: formData.product_id || null, // Allow clearing
        species_id: formData.species_id || null
      };

      const { data, error } = await supabase
        .from('inventory')
        .update(updatePayload)
        .eq('id', bundle.id)
        .select()
        .single();

      if (error) throw error;
      
      // If status changed, record it in status_changes
      if (formData.status_id && Number(formData.status_id) !== Number(bundle.status_id)) {
        const { error: statusError } = await supabase
          .from('status_changes')
          .insert([{
            inventory_id: bundle.id,
            status_id: formData.status_id,
            updated_by: session?.user?.id,
            notes: formData.note || 'Status adjusted via Tag Lookup tool'
          }]);
        if (statusError) {
          console.error("Error recording status change:", statusError);
          alert("Status update failed: " + statusError.message);
          return; // Stop here if status update failed
        }
      }

      // Small delay before re-fetching to ensure the database view (with its subquery) reflects the insert
      await new Promise(res => setTimeout(res, 500));

      // Re-fetch from view to get updated current_status badge and status_id
      const { data: refreshedBundle } = await supabase
        .from('inventory_view')
        .select('*')
        .eq('id', bundle.id)
        .single();

      if (refreshedBundle) {
        setBundle(refreshedBundle);
        setFormData(prev => ({ 
          ...prev, 
          status_id: refreshedBundle.status_id || '' 
        }));
      }
      
      if (print) {
        handlePrint(data);
      }
      
    } catch (err) {
      alert('Save Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (updatedBundle) => {
    try {
      const qtyLabel = (updatedBundle.unit_type === 'Bd Ft' || (updatedBundle.boardfeet && parseFloat(updatedBundle.boardfeet) > 0)) ? 'BdFt' : 'Qty';
      const qtyValue = (qtyLabel === 'BdFt' ? updatedBundle.boardfeet : updatedBundle.quantity) || 0;
      const qrText = `${updatedBundle.tag} ${updatedBundle.product_name} ${qtyLabel} ${qtyValue}`.replace(/\s+/g, ' ').trim();
      const qrCodeUrl = await QRCode.toDataURL(qrText);
      const blob = await pdf(<InventoryTagPDF data={updatedBundle} qrCodeUrl={qrCodeUrl} copies={1} />).toBlob();
      const url = URL.createObjectURL(blob);

      if (isTest) {
        window.open(url, '_blank');
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
        };
      }
    } catch (err) {
      console.error("Print error:", err);
      alert("Print failed.");
    }
  };

  // Styles
  const cardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' };
  const inputStyle = { padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' };
  const fieldRowStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' };
  
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'in stock': return '#28a745'; // Green
      case 'sold': return '#6c757d';     // Gray
      case 'void': return '#dc3545';     // Red
      case 'issued': return '#007bff';   // Blue
      default: return '#ffc107';        // Amber/Warning
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>Inventory Tag Lookup & Adjustment</h2>
      
      {/* 1. Search Box */}
      <div style={{ ...cardStyle, backgroundColor: '#f8f9fa', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Search by Tag #</label>
          <input 
            type="text" 
            placeholder="e.g. 104562" 
            value={searchTag} 
            onChange={(e) => setSearchTag(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={inputStyle}
          />
        </div>
        <button 
          onClick={handleSearch} 
          disabled={loading}
          style={{ padding: '8px 25px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Searching...' : 'Find Tag'}
        </button>
      </div>

      {bundle && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
            <div>
              <h3 style={{ margin: 0 }}>Tag #{bundle.tag} - {bundle.product_name}</h3>
              <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                Species: {bundle.species_name || 'None'} | Produced: {new Date(bundle.produced).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} | Line: {bundle.line} | Tagger: {bundle.tagger || '-'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ 
                backgroundColor: getStatusColor(bundle.current_status), 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: '20px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {bundle.current_status || 'UNKNOWN'}
              </span>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div style={fieldRowStyle}>
              <div style={{ flex: '1.2' }}>
                <label style={labelStyle}>Product Description</label>
                <select name="product_id" value={formData.product_id} onChange={handleChange} style={inputStyle}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                  {/* Handle deleted products by showing the snapshot name */}
                  {formData.product_id && !products.find(p => p.id == formData.product_id) && (
                    <option value={formData.product_id} disabled>
                      {bundle.product_name} (Legacy/Deleted)
                    </option>
                  )}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '15px', flex: '2' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Species</label>
                  <select name="species_id" value={formData.species_id} onChange={handleChange} style={inputStyle}>
                    <option value="">-- No Species --</option>
                    {species.map(s => <option key={s.id} value={s.id}>{s.species_name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Manual Status Override</label>
                  <select name="status_id" value={formData.status_id} onChange={handleChange} style={{ ...inputStyle, border: '1px solid #ffc107', backgroundColor: '#fffbe6' }}>
                    {statuses.map(st => <option key={st.id} value={st.id}>{st.status_name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={fieldRowStyle}>
              <div>
                <label style={labelStyle}>Board Feet</label>
                <input type="number" step="0.01" name="boardfeet" value={formData.boardfeet} onChange={handleChange} style={inputStyle} />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Original: {bundle.boardfeet}</div>
              </div>
              <div>
                <label style={labelStyle}>Quantity (Pieces)</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} style={inputStyle} />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Original: {bundle.quantity}</div>
              </div>
            </div>

            <div style={fieldRowStyle}>
              <div>
                <label style={labelStyle}>Inventory Value ($)</label>
                <input type="number" step="0.01" name="inventory_value" value={formData.inventory_value} onChange={handleChange} style={inputStyle} />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Cost Basis: ${bundle.unit_inv_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Sales Value ($)</label>
                <input type="number" step="0.01" name="sales_value" value={formData.sales_value} onChange={handleChange} style={inputStyle} />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Target Price: ${bundle.unit_product_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={fieldRowStyle}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Customer Allocation</label>
                <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} placeholder="e.g. Cabin Masters Inc." style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Adjustment Notes</label>
              <input type="text" name="note" value={formData.note} onChange={handleChange} placeholder="Reason for adjustment..." style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '15px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <button 
                type="button" 
                onClick={() => handleSave(false)} 
                disabled={saving}
                style={{ flex: 1, padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {saving ? 'Saving...' : 'Save Adjustments'}
              </button>
              <button 
                type="button" 
                onClick={() => handleSave(true)} 
                disabled={saving}
                style={{ flex: 1, padding: '12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Save & Re-print Tag
              </button>
            </div>
          </form>
        </div>
      )}
      
      {!bundle && !loading && (
        <div style={{ textAlign: 'center', marginTop: '50px', color: '#999' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
          <p>Search for a Tag number to begin an adjustment.</p>
        </div>
      )}
    </div>
  );
}
