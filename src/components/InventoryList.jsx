import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import StatusHistoryModal from './StatusHistoryModal';

export default function InventoryList() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState(null);

  useEffect(() => {
    const fetchBundles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_view')
        .select(`*`)
        .order('produced', { ascending: false })
        .limit(10);

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
