import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { InventoryTagPDF } from './InventoryTag';
import QRCode from 'qrcode';
import { saveAs } from 'file-saver';

export default function PrintTagModal({ 
  data, 
  mode = 'report', // 'entry' or 'report'
  onClose 
}) {
  const [copies, setCopies] = useState(2);
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionType) => {
    setLoading(true);
    try {
      // 1. Generate QR Code Data URI
      const qrText = `Tag: ${data.tag}\n${data.product_name}\nDim: ${data.length || '-'}x${data.width || '-'}x${data.rows || '-'}`;
      const qrCodeUrl = await QRCode.toDataURL(qrText);

      // 2. Generate PDF Blob
      // NOTE: We pass 'copies' so the PDF component can render multiple pages if needed later
      const blob = await pdf(<InventoryTagPDF data={data} qrCodeUrl={qrCodeUrl} copies={copies} />).toBlob();

      // 3. Handle action based on mode
      if (actionType === 'download') {
        saveAs(blob, `tag_${data.tag}.pdf`);
      } else if (actionType === 'print') {
        // Create an Object URL to open in a new tab for native printing/viewing
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error generating tag:', error);
      alert('Failed to generate tag PDF.');
    } finally {
      setLoading(false);
      onClose(); // Close modal after generating
    }
  };

  if (!data) return null;

  const modalStyle = { 
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', 
    alignItems: 'center', zIndex: 1000 
  };
  
  const contentStyle = { 
    backgroundColor: 'white', padding: '25px', borderRadius: '8px', 
    width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px' 
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 10px 0' }}>
          {mode === 'entry' ? 'Success! Bundle Created' : 'Print Tag'}
        </h3>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '18px' }}><strong>Tag #:</strong> {data.tag}</p>
          <p style={{ margin: '0' }}><strong>Product:</strong> {data.product_name}</p>
          
          {/* Only show the number of copies selector if we are in "entry" mode */}
          {mode === 'entry' && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Number of Tags to Print:</label>
              <input 
                type="number" 
                min="1" 
                value={copies} 
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: '0' }}>
                * Most items get two tags. "Issued" items may require a different number.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button 
            onClick={onClose} 
            disabled={loading}
            style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {mode === 'entry' ? 'Close & Next Entry' : 'Cancel'}
          </button>
          
          {mode === 'entry' ? (
            <button 
              onClick={() => handleAction('print')}
              disabled={loading}
              style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Generating...' : 'Open & Print'}
            </button>
          ) : (
            <button 
              onClick={() => handleAction('download')}
              disabled={loading}
              style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Generating...' : 'Download'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
