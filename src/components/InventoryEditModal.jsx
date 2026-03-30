import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { pdf } from '@react-pdf/renderer'
import { InventoryTagPDF } from './InventoryTag'
import QRCode from 'qrcode'

const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1100,
};

const contentStyle = {
  backgroundColor: 'white',
  padding: '25px',
  borderRadius: '8px',
  width: '95%',
  maxWidth: '800px',
  maxHeight: '90%',
  overflowY: 'auto',
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
};

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '15px',
  marginBottom: '15px',
  padding: '12px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9',
};

const inputGroupStyle = {
  display: 'flex', flexDirection: 'column', marginBottom: '8px',
};

const labelStyle = {
  fontWeight: 'bold', marginBottom: '3px', color: '#333', fontSize: '14px'
};

const inputStyle = {
  padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px',
};

export default function InventoryEditModal({ bundle, onClose, onRefresh, isTest }) {
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [allSpecies, setAllSpecies] = useState([])
  const [filteredSpecies, setFilteredSpecies] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [calculatedBoardFeet, setCalculatedBoardFeet] = useState('');

  const [formData, setFormData] = useState({
    product_id: bundle.product_id || '',
    species_id: bundle.species_id || '',
    line: bundle.line || '',
    boardfeet: bundle.boardfeet || '',
    quantity: bundle.quantity || '',
    length: bundle.length || '',
    width: bundle.width || '',
    rows: bundle.rows || '',
    note: bundle.note || '',
    customer_name: bundle.customer_name || '',
    tagger: bundle.tagger || bundle.tagger_name || '',
    copies: 0
  })

  // 1. Initial Data Fetch (Products & Species)
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: speciesData } = await supabase
        .from('species')
        .select('id, species_name')
        .order('species_name');
      setAllSpecies(speciesData || []);

      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .order('product_name');
      setProducts(productData || []);
      
      // Find initial product
      if (bundle.product_id) {
        const product = productData?.find(p => p.id === bundle.product_id);
        if (product) setSelectedProduct(product);
      }
    }
    fetchInitialData()
  }, [bundle.product_id])

  // 2. Handle Product Selection & Filter Species
  useEffect(() => {
    if (selectedProduct) {
      const filterSpecies = async () => {
        let finalSpeciesList = allSpecies;
        if (selectedProduct.group_id) {
          const { data: groupLinks } = await supabase
            .from('species_groups')
            .select('species_id')
            .eq('id', selectedProduct.group_id);

          if (groupLinks && groupLinks.length > 0) {
            const allowedIds = groupLinks.map(link => link.species_id);
            finalSpeciesList = allSpecies.filter(s => allowedIds.includes(s.id));
          } else {
            finalSpeciesList = [];
          }
        }
        setFilteredSpecies(finalSpeciesList);
      };
      filterSpecies();
    }
  }, [selectedProduct, allSpecies]);

  const handleProductChange = (e) => {
    const pId = e.target.value;
    const product = products.find(p => p.id == pId);
    setSelectedProduct(product);
    setFormData({
      ...formData,
      product_id: pId,
      species_id: product?.species_id || '',
      boardfeet: '',
      quantity: product?.unit_type === 'Each' ? (product.default_quantity || '') : '',
      length: '', width: '', rows: ''
    });
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
        // Auto-update boardfeet if it's currently empty or results from a calc
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

  // 4. Submit Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalBoardFeet = formData.boardfeet ? parseFloat(formData.boardfeet) : 0.00;
    const qtyValue = formData.quantity ? parseInt(formData.quantity) : 0;
    const isBoardFeetProduct = selectedProduct && selectedProduct.unit_type === 'Bd Ft';

    try {
      // Determine if we should update snapshot or use existing
      // If product ID changed, update snapshot. Otherwise, use existing snapshot unit values.
      let unitCost = bundle.unit_inv_value;
      let unitSalesPrice = bundle.unit_product_value;
      let thickness = bundle.thickness;
      let productName = bundle.product_name;
      let unitType = bundle.unit_type;

      if (formData.product_id != bundle.product_id) {
        unitCost = parseFloat(selectedProduct.unit_inv_value) || 0;
        unitSalesPrice = parseFloat(selectedProduct.unit_product_value) || 0;
        thickness = selectedProduct.thickness;
        productName = selectedProduct.product_name;
        unitType = selectedProduct.unit_type;
      }

      const snapshotValue = isBoardFeetProduct ? (finalBoardFeet * unitCost) : (qtyValue * unitCost);
      const predictedSalesValue = isBoardFeetProduct ? (finalBoardFeet * unitSalesPrice) : (qtyValue * unitSalesPrice);

      const selectedSpecies = allSpecies.find(s => s.id == formData.species_id);

      const updateData = {
        product_id: formData.product_id,
        species_id: formData.species_id || null,
        product_name: productName,
        species_name: selectedSpecies?.species_name || null,
        unit_type: unitType,
        thickness: thickness,
        unit_inv_value: unitCost,
        unit_product_value: unitSalesPrice,
        line: formData.line,
        boardfeet: finalBoardFeet,
        quantity: qtyValue,
        inventory_value: snapshotValue,
        sales_value: predictedSalesValue,
        length: formData.length || null,
        width: formData.width || null,
        rows: formData.rows || null,
        note: formData.note,
        customer_name: formData.customer_name || null,
        tagger: formData.tagger || null
      };

      const { data, error } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', bundle.id)
        .select();

      if (error) throw error

      // Print Tag if requested
      if (formData.copies > 0) {
        const bundleData = { ...data[0], isTest: isTest };
        const qtyLabel = (bundleData.unit_type === 'Bd Ft' || (bundleData.boardfeet && parseFloat(bundleData.boardfeet) > 0)) ? 'BdFt' : 'Qty';
        const qtyValue = (qtyLabel === 'BdFt' ? bundleData.boardfeet : bundleData.quantity) || 0;
        const qrText = `${bundleData.tag} ${bundleData.product_name} ${qtyLabel} ${qtyValue}`.replace(/\s+/g, ' ').trim();
        const qrCodeUrl = await QRCode.toDataURL(qrText);
        const blob = await pdf(<InventoryTagPDF data={bundleData} qrCodeUrl={qrCodeUrl} copies={parseInt(formData.copies)} />).toBlob();
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
            setTimeout(() => {
              if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 60000);
          };
        }
      }

      onRefresh();
      onClose();

    } catch (error) {
      alert('Error updating bundle: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const isBoardFeetProduct = selectedProduct && selectedProduct.unit_type === 'Bd Ft';
  const bfInputBackgroundColor = isBoardFeetProduct
    ? (formData.boardfeet === calculatedBoardFeet && calculatedBoardFeet !== '' ? '#d0ffc0' : '#fffbe0')
    : '#fff';

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom: '20px' }}>
          Edit Bundle Tag #{bundle.tag}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Row 1: Product Type | Species */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Product Type</label>
                <select name="product_id" value={formData.product_id} onChange={handleProductChange} required style={inputStyle}>
                  <option value="">-- Select Product --</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>{prod.product_name} ({prod.unit_type})</option>
                  ))}
                  {/* Handle deleted products by showing the snapshot name */}
                  {formData.product_id && !products.find(p => p.id == formData.product_id) && (
                    <option value={formData.product_id} disabled>
                      {bundle.product_name} (Legacy/Deleted)
                    </option>
                  )}
                </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Species</label>
              <select name="species_id" value={formData.species_id} onChange={handleChange} required style={inputStyle} disabled={!selectedProduct}>
                <option value="">-- Select Species --</option>
                {filteredSpecies.map((s) => (
                  <option key={s.id} value={s.id}>{s.species_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Production Line | Tagger | Copies */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Production Line</label>
              <select name="line" value={formData.line} onChange={handleChange} required style={inputStyle}>
                <option value="">-- Select Line --</option>
                <option value="A">Line A</option><option value="B">Line B</option><option value="C">Line C</option>
                <option value="D">Line D</option><option value="P">Line P</option><option value="R">Line R</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Tagger</label>
              <input name="tagger" type="text" value={formData.tagger} onChange={handleChange} required style={inputStyle} />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Re-print Copies?</label>
              <select name="copies" value={formData.copies} onChange={handleChange} style={inputStyle}>
                <option value="0">Don't Re-print</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>

          {/* Special Order Customer */}
          {selectedProduct && selectedProduct.is_special_order && (
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Customer <span style={{ color: 'red' }}>*</span></label>
              <input name="customer_name" type="text" value={formData.customer_name} onChange={handleChange} required style={inputStyle} />
            </div>
          )}

          {/* Dimensions / Qty */}
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

          <div style={inputGroupStyle}><label style={labelStyle}>Notes</label><input name="note" type="text" value={formData.note} onChange={handleChange} style={inputStyle} /></div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
            <button
              type="submit"
              disabled={loading || !selectedProduct}
              style={{ flex: 1, padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
