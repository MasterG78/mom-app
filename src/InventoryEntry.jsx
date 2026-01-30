import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Styles
const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '20px',
  marginBottom: '20px',
  padding: '15px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9',
};

const inputGroupStyle = {
  display: 'flex', flexDirection: 'column', marginBottom: '10px',
};

const labelStyle = {
  fontWeight: 'bold', marginBottom: '5px', color: '#333',
};

const inputStyle = {
  padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '16px',
};

export default function InventoryEntry({ session, onBundleCreated }) {
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [allSpecies, setAllSpecies] = useState([])
  const [filteredSpecies, setFilteredSpecies] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [calculatedBoardFeet, setCalculatedBoardFeet] = useState('');

  const [formData, setFormData] = useState({
    product_id: '',
    species_id: '',
    line: '',
    boardfeet: '',
    quantity: '',
    length: '',
    width: '',
    rows: '',
    note: ''
  })

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: speciesData } = await supabase
        .from('species')
        .select('id, species_name')
        .order('species_name');
      setAllSpecies(speciesData || []);

      let query = supabase
        .from('products')
        .select('id, product_name, unit_type, default_quantity, thickness, species_id, group_id, unit_inv_value, unit_product_value, menu_show');

      if (!showAll) query = query.eq('menu_show', true);

      const { data: productData } = await query.order('product_name');
      setProducts(productData || []);
    }
    fetchInitialData()
  }, [showAll])

  // 2. Handle Product Selection & Cross-Table Filtering
  const handleProductChange = async (e) => {
    const pId = e.target.value;
    const product = products.find(p => p.id == pId);

    setSelectedProduct(product);
    setCalculatedBoardFeet('');

    if (product) {
      let finalSpeciesList = allSpecies;

      // If there is a group_id, fetch the allowed species from SpeciesGroups
      if (product.group_id) {
        // Querying the junction table based on the Product's group_id
        const { data: groupLinks } = await supabase
          .from('species_groups')
          .select('species_id')
          .eq('id', product.group_id);

        if (groupLinks && groupLinks.length > 0) {
          const allowedIds = groupLinks.map(link => link.species_id);
          finalSpeciesList = allSpecies.filter(s => allowedIds.includes(s.id));
        } else {
          // If a group exists but has no species rows yet, list is empty to maintain "Restrict" rule
          finalSpeciesList = [];
        }
      }

      setFilteredSpecies(finalSpeciesList);

      setFormData({
        ...formData,
        product_id: pId,
        species_id: product.species_id || '',
        boardfeet: '',
        quantity: product.unit_type === 'Each' ? (product.default_quantity || '') : '',
        length: '', width: '', rows: '', note: ''
      });
    } else {
      setFilteredSpecies([]);
      setFormData({ ...formData, product_id: '', species_id: '', boardfeet: '', quantity: '' });
    }
  }

  // 3. Calculation Logic
  useEffect(() => {
    const { length, width, rows, boardfeet } = formData;
    if (selectedProduct && selectedProduct.unit_type === 'Bd Ft') {
      const L = parseFloat(length), W = parseFloat(width), R = parseFloat(rows), T = parseFloat(selectedProduct.thickness);
      if (!isNaN(L) && !isNaN(W) && !isNaN(R) && L > 0 && W > 0 && R > 0 && T > 0) {
        const result = (L * W * R * T) / 12;
        const roundedResult = Math.round(result * 100) / 100;
        setCalculatedBoardFeet(roundedResult.toString());
        if (!boardfeet || boardfeet === '' || parseFloat(boardfeet) === parseFloat(calculatedBoardFeet)) {
          setFormData(prev => ({ ...prev, boardfeet: roundedResult.toString() }));
        }
      } else {
        setCalculatedBoardFeet('');
      }
    }
  }, [formData.length, formData.width, formData.rows, selectedProduct]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // 4. Submit with Snapshot
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalBoardFeet = formData.boardfeet ? parseFloat(formData.boardfeet) : 0.00;
    const qtyValue = formData.quantity ? parseInt(formData.quantity) : 0;
    const isBoardFeetProduct = selectedProduct && selectedProduct.unit_type === 'Bd Ft';

    try {
      const unitCost = parseFloat(selectedProduct.unit_inv_value) || 0;
      const snapshotValue = isBoardFeetProduct ? (finalBoardFeet * unitCost) : (qtyValue * unitCost);

      const unitSalesPrice = parseFloat(selectedProduct.unit_product_value) || 0;
      const predictedSalesValue = isBoardFeetProduct ? (finalBoardFeet * unitSalesPrice) : (qtyValue * unitSalesPrice);

      const { data, error } = await supabase
        .from('inventory')
        .insert([{
          product_id: formData.product_id,
          species_id: formData.species_id || null,
          line: formData.line,
          boardfeet: finalBoardFeet,
          quantity: qtyValue,
          inventory_value: snapshotValue, // snapshot locked
          length: formData.length || null,
          width: formData.width || null,
          rows: formData.rows || null,
          note: formData.note,
          produced: new Date(),
          sales_value: predictedSalesValue // Predicted Price
        }])
        .select()

      if (error) throw error
      alert(`Success! Bundle Created. Tag #: ${data[0].tag}`)
      setFormData({ product_id: '', species_id: '', line: '', boardfeet: '', quantity: '', length: '', width: '', rows: '', note: '' })
      setSelectedProduct(null);
      if (onBundleCreated) onBundleCreated();
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const isBoardFeetProduct = selectedProduct && selectedProduct.unit_type === 'Bd Ft';
  const bfInputBackgroundColor = isBoardFeetProduct
    ? (formData.boardfeet === calculatedBoardFeet && calculatedBoardFeet !== '' ? '#d0ffc0' : '#fffbe0')
    : '#fff';

  return (
    <div className="form-widget">
      <h2>Add Inventory Bundle</h2>
      <form onSubmit={handleSubmit}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={inputGroupStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Product Type</label>
              <label style={{ fontSize: '12px', cursor: 'pointer', color: '#666' }}>
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} style={{ marginRight: '5px' }} />
                Show All
              </label>
            </div>
            <select name="product_id" value={formData.product_id} onChange={handleProductChange} required style={inputStyle}>
              <option value="">-- Select Product --</option>
              {products.map((prod) => (
                <option key={prod.id} value={prod.id}>{prod.product_name} ({prod.unit_type})</option>
              ))}
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Production Line</label>
            <select name="line" value={formData.line} onChange={handleChange} required style={inputStyle}>
              <option value="">-- Select Line --</option>
              <option value="A">Line A</option><option value="B">Line B</option><option value="C">Line C</option>
              <option value="D">Line D</option><option value="P">Line P</option><option value="R">Line R</option>
            </select>
          </div>
        </div>

        {/* Species Selection with Indicator */}
        <div style={inputGroupStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={labelStyle}>Species</label>
            {selectedProduct && (
              <span style={{ fontSize: '11px', color: selectedProduct.group_id ? '#28a745' : '#666', fontStyle: 'italic' }}>
                {selectedProduct.group_id ? '✓ Filtered by Group' : 'Showing All Species'}
              </span>
            )}
          </div>
          <select
            name="species_id"
            value={formData.species_id}
            onChange={handleChange}
            required
            style={inputStyle}
            disabled={!selectedProduct}
          >
            <option value="">-- Select Species --</option>
            {filteredSpecies.map((s) => (
              <option key={s.id} value={s.id}>{s.species_name}</option>
            ))}
          </select>
          {selectedProduct?.group_id && filteredSpecies.length === 0 && (
            <p style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>
              Warning: No species found assigned to this group.
            </p>
          )}
        </div>

        {selectedProduct && (
          <div style={formGridStyle}>
            {isBoardFeetProduct ? (
              <>
                <div style={inputGroupStyle}><label style={labelStyle}>Length (Ft)</label><input name="length" type="number" step="0.1" value={formData.length} onChange={handleChange} style={inputStyle} /></div>
                <div style={inputGroupStyle}><label style={labelStyle}>Width (In)</label><input name="width" type="number" step="0.1" value={formData.width} onChange={handleChange} style={inputStyle} /></div>
                <div style={inputGroupStyle}><label style={labelStyle}>Rows</label><input name="rows" type="number" value={formData.rows} onChange={handleChange} style={inputStyle} /></div>
                <div style={inputGroupStyle}><label style={labelStyle}>Board Feet</label><input name="boardfeet" type="number" step="0.01" value={formData.boardfeet} onChange={handleChange} style={{ ...inputStyle, backgroundColor: bfInputBackgroundColor }} /></div>
              </>
            ) : (
              <div style={inputGroupStyle}><label style={labelStyle}>Quantity</label><input name="quantity" type="number" value={formData.quantity} onChange={handleChange} required style={inputStyle} /></div>
            )}
          </div>
        )}

        <div style={{ ...inputGroupStyle, marginTop: '20px' }}><label style={labelStyle}>Notes</label><input name="note" type="text" value={formData.note} onChange={handleChange} style={inputStyle} /></div>
        <button className="button block primary" disabled={loading || !selectedProduct} style={{ width: '100%', padding: '15px', marginTop: '20px', fontSize: '18px' }}>
          {loading ? 'Printing Tag...' : 'Create Bundle & Get Tag'}
        </button>
      </form>
    </div>
  )
}