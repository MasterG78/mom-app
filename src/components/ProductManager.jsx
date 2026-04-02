import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [species, setSpecies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    product_name: '',
    unit_type: 'Each', // Changed from 'Bd Ft' to 'Each' as requested
    unit_product_value: 0,
    unit_inv_value: 0,
    thickness: 1.00,
    unit_boardfeet: '',
    default_length: '',
    default_quantity: '',
    species_id: '',
    group_id: '',
    account: '',
    account_product: '',
    menu_show: true,
    is_special_order: false
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const [p, s, g] = await Promise.all([
      supabase.from('products').select('*').order('product_name'),
      supabase.from('species').select('id, species_name'),
      supabase.from('species_groups').select('id, group_name')
    ]);
    setProducts(p.data || []);
    setSpecies(s.data || []);
    setGroups(g.data || []);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      product_name: formData.product_name,
      unit_type: formData.unit_type,
      unit_product_value: parseFloat(formData.unit_product_value) || 0,
      unit_inv_value: parseFloat(formData.unit_inv_value) || 0,
      thickness: parseFloat(formData.thickness) || 1.00,
      unit_boardfeet: formData.unit_boardfeet ? parseFloat(formData.unit_boardfeet) : null,
      default_length: formData.default_length ? parseFloat(formData.default_length) : null,
      default_quantity: formData.unit_type === 'Bd Ft' ? 0 : (formData.default_quantity ? parseInt(formData.default_quantity) : null),
      species_id: formData.species_id ? parseInt(formData.species_id) : null,
      group_id: formData.group_id ? parseInt(formData.group_id) : null,
      account: formData.account ? parseInt(formData.account) : null,
      account_product: formData.account_product || null,
      menu_show: formData.menu_show,
      is_special_order: formData.is_special_order
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId);
      if (error) alert("Update Error: " + error.message);
      else setEditingId(null);
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) alert("Insert Error: " + error.message);
    }

    setFormData(initialForm);
    fetchInitialData();
    setLoading(false);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setFormData({
      ...p,
      species_id: p.species_id || '',
      group_id: p.group_id || '',
      unit_boardfeet: p.unit_boardfeet || '',
      default_length: p.default_length || '',
      default_quantity: p.default_quantity || '',
      account: p.account || '',
      account_product: p.account_product || '',
      is_special_order: p.is_special_order || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') alert(`Cannot delete "${name}": Linked to Inventory history.`);
        else alert("Error: " + error.message);
      } else fetchInitialData();
    }
  };

  // Styles
  const inputStyle = { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' };
  const labelStyle = { fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '13px' };
  const thStyle = { padding: '10px', borderBottom: '2px solid #dee2e6', fontSize: '12px', backgroundColor: '#f8f9fa', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '10px', borderBottom: '1px solid #eee', fontSize: '12px', whiteSpace: 'nowrap' };

  // Animation Style
  const fadeInStyle = {
    animation: 'fadeIn 0.3s ease-in',
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px' }}>
      <style>
        {`@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}
      </style>

      <h2 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom: '20px' }}>
        {editingId ? `Editing: ${formData.product_name}` : 'Product Catalog Management'}
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '40px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <div>
          <label style={labelStyle}>Product Name*</label>
          <input required style={inputStyle} value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} />
        </div>

        <div>
          <label style={labelStyle}>Unit Type</label>
          <select style={inputStyle} value={formData.unit_type} onChange={e => setFormData({ ...formData, unit_type: e.target.value })}>
            <option value="Bd Ft">Bd Ft</option>
            <option value="Each">Each</option>
          </select>
        </div>

        {/* CONDITION: Show Thickness ONLY when 'Bd Ft' is selected */}
        {formData.unit_type === 'Bd Ft' && (
          <div style={fadeInStyle}>
            <label style={labelStyle}>Thickness</label>
            <input type="number" step="0.01" style={inputStyle} value={formData.thickness} onChange={e => setFormData({ ...formData, thickness: e.target.value })} />
          </div>
        )}

        <div>
          <label style={labelStyle}>Species</label>
          <select style={inputStyle} value={formData.species_id} onChange={e => setFormData({ ...formData, species_id: e.target.value })}>
            <option value="">-- None --</option>
            {species.map(s => <option key={s.id} value={s.id}>{s.species_name}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Group</label>
          <select style={inputStyle} value={formData.group_id} onChange={e => setFormData({ ...formData, group_id: e.target.value })}>
            <option value="">-- None --</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
          </select>
        </div>

        {/* CONDITION: Show Unit Boardfeet ONLY when 'Each' is selected */}
        {formData.unit_type === 'Each' && (
          <div style={fadeInStyle}>
            <label style={labelStyle}>Unit Boardfeet</label>
            <input type="number" step="0.01" style={inputStyle} value={formData.unit_boardfeet} onChange={e => setFormData({ ...formData, unit_boardfeet: e.target.value })} />
          </div>
        )}

        <div>
          <label style={labelStyle}>Default Length</label>
          <input type="number" step="0.01" style={inputStyle} value={formData.default_length} onChange={e => setFormData({ ...formData, default_length: e.target.value })} />
        </div>
        {formData.unit_type !== 'Bd Ft' && (
          <div style={fadeInStyle}>
            <label style={labelStyle}>Default Quantity</label>
            <input type="number" style={inputStyle} value={formData.default_quantity} onChange={e => setFormData({ ...formData, default_quantity: e.target.value })} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Inv Value ($)</label>
          <input type="number" step="0.01" style={inputStyle} value={formData.unit_inv_value} onChange={e => setFormData({ ...formData, unit_inv_value: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Account #</label>
          <input type="number" style={inputStyle} value={formData.account} onChange={e => setFormData({ ...formData, account: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Account Name</label>
          <input style={inputStyle} value={formData.account_product} onChange={e => setFormData({ ...formData, account_product: e.target.value })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '25px' }}>
          <input type="checkbox" id="menu_show" checked={formData.menu_show} onChange={e => setFormData({ ...formData, menu_show: e.target.checked })} />
          <label htmlFor="menu_show" style={{ fontWeight: 'bold', fontSize: '13px' }}>Show in Menus</label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '25px' }}>
          <input type="checkbox" id="is_special_order" checked={formData.is_special_order} onChange={e => setFormData({ ...formData, is_special_order: e.target.checked })} />
          <label htmlFor="is_special_order" style={{ fontWeight: 'bold', fontSize: '13px', color: '#dc3545' }}>Special Order Item</label>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" disabled={loading} style={{ padding: '10px 30px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {editingId ? 'Save Changes' : 'Add Product'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setFormData(initialForm); }} style={{ padding: '10px 20px', borderRadius: '4px', border: '1px solid #ccc' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* TABLE SECTION remains unchanged */}
      <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Full Product List</h3>
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Thick</th>
              <th style={thStyle}>Unit BdFt</th>
              <th style={thStyle}>Def. Len</th>
              <th style={thStyle}>Def. Qty</th>
              <th style={thStyle}>Inv Value</th>
              <th style={thStyle}>Account</th>
              <th style={thStyle}>Acc Name</th>
              <th style={thStyle}>Special?</th>
              <th style={thStyle}>Visible</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{p.product_name}</td>
                <td style={tdStyle}>{p.unit_type}</td>
                <td style={tdStyle}>{p.thickness}"</td>
                <td style={tdStyle}>{p.unit_boardfeet || '-'}</td>
                <td style={tdStyle}>{p.default_length || '-'}</td>
                <td style={tdStyle}>{p.default_quantity || '-'}</td>
                <td style={tdStyle}>${p.unit_inv_value?.toFixed(2)}</td>
                <td style={tdStyle}>{p.account || '-'}</td>
                <td style={tdStyle}>{p.account_product || '-'}</td>
                <td style={tdStyle}>{p.is_special_order ? 'YES' : '-'}</td>
                <td style={tdStyle}>{p.menu_show ? 'Yes' : 'No'}</td>
                <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <button onClick={() => startEdit(p)} style={{ marginRight: '5px' }}>Edit</button>
                  <button onClick={() => handleDelete(p.id, p.product_name)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
