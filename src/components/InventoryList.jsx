import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import StatusHistoryModal from './StatusHistoryModal';
import { pdf } from '@react-pdf/renderer'
import { InventoryTagPDF } from './InventoryTag'
import QRCode from 'qrcode'

export default function InventoryList({ isTest }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState(null);

  useEffect(() => {
    const fetchBundles = async () => {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('inventory_view')
        .select(`*`)
        .gte('produced', today.toISOString())
        .order('produced', { ascending: false });

      if (error) {
        console.error('Error fetching inventory:', error.message);
      } else {
        setBundles(data);
      }
      setLoading(false);
    };

    fetchBundles();
  }, []);

  const handleRowClick = (bundle) => {
    setSelectedBundle(bundle);
  };

  const handleCloseModal = () => {
    setSelectedBundle(null);
  };

  const handlePrint = async (e, bundle) => {
    e.stopPropagation(); // Don't open the history modal
    
    try {
      const qtyLabel = (bundle.unit_type === 'Bd Ft' || (bundle.boardfeet && parseFloat(bundle.boardfeet) > 0)) ? 'BdFt' : 'Qty';
      const qtyValue = (qtyLabel === 'BdFt' ? bundle.boardfeet : bundle.quantity) || 0;
      const qrText = `${bundle.tag} ${bundle.product_name} ${qtyLabel} ${qtyValue}`.replace(/\s+/g, ' ').trim();
      const qrCodeUrl = await QRCode.toDataURL(qrText);
      const blob = await pdf(<InventoryTagPDF data={bundle} qrCodeUrl={qrCodeUrl} copies={1} />).toBlob();
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
    } catch (printErr) {
      console.error("Error generating tag:", printErr);
      alert("Failed to generate PDF for printing.");
    }
  };

  if (loading) return <div>Loading recent inventory...</div>;
  if (bundles.length === 0) return <div>No inventory bundles found.</div>;

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Recent Bundles (Click Row for History)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>Tag #</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Produced</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Line</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Product</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Qty</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>BdFt</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Tagger</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {bundles.map((bundle) => (
            <tr
              key={bundle.tag}
              onClick={() => handleRowClick(bundle)}
              style={{
                borderBottom: '1px dotted #eee',
                cursor: 'pointer',
                backgroundColor: selectedBundle?.id === bundle.id ? '#f0f8ff' : 'white'
              }}
            >
              <td style={{ padding: '8px' }}>{bundle.tag}</td>
              <td style={{ padding: '8px', fontSize: '13px' }}>
                {new Date(bundle.produced).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </td>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{bundle.line || '-'}</td>
              <td style={{ padding: '8px' }}>{bundle.product_name}</td>
              <td style={{ padding: '8px' }}>{bundle.quantity || '-'}</td>
              <td style={{ padding: '8px' }}>{bundle.boardfeet || '-'}</td>
              <td style={{ padding: '8px' }}>{bundle.tagger}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <button 
                  onClick={(e) => handlePrint(e, bundle)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  Print Tag
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedBundle && (
        <StatusHistoryModal
          inventoryId={selectedBundle.id}
          tag={selectedBundle.tag}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
