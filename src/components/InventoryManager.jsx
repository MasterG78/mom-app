import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import InventoryEditModal from './InventoryEditModal';

export default function InventoryManager({ isTest, session }) {
  const [searchTag, setSearchTag] = useState('');
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Search for Tag
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchTag) return;
    
    setLoading(true);
    setBundle(null);
    setShowEditModal(false);
    
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
        setShowEditModal(true); // Automatically open the unified edit modal
      }
    } catch (err) {
      alert('Search Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // Re-fetch the tag details after an edit to update the background search info (if needed)
    handleSearch();
  };

  // Styles
  const cardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' };
  const inputStyle = { padding: '12px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '16px' };
  const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' };
  
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom: '30px' }}>Inventory Tag Lookup</h2>
      
      {/* Search Box */}
      <div style={{ ...cardStyle, backgroundColor: '#f8f9fa', display: 'flex', gap: '10px', alignItems: 'flex-end', padding: '30px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Enter Tag Number</label>
          <input 
            type="text" 
            placeholder="e.g. 104562" 
            value={searchTag} 
            onChange={(e) => setSearchTag(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={inputStyle}
            autoFocus
          />
        </div>
        <button 
          onClick={handleSearch} 
          disabled={loading}
          style={{ 
            padding: '12px 35px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            fontSize: '16px',
            height: '48px'
          }}
        >
          {loading ? 'Searching...' : 'Find Tag'}
        </button>
      </div>

      {/* Found Tag Summary (Behind the modal) */}
      {bundle && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0 }}>Tag #{bundle.tag}</h3>
              <p style={{ margin: '10px 0', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                {bundle.product_name || 'Unknown Product'}
              </p>
              <div style={{ color: '#666', fontSize: '14px' }}>
                Species: {bundle.species_name || 'None'} <br/>
                Produced: {new Date(bundle.produced).toLocaleDateString()} <br/>
                Line: {bundle.line} | Tagger: {bundle.tagger || '-'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ 
                backgroundColor: getStatusColor(bundle.current_status), 
                color: 'white', 
                padding: '6px 15px', 
                borderRadius: '20px', 
                fontSize: '13px', 
                fontWeight: 'bold',
                textTransform: 'uppercase',
                marginBottom: '10px',
                display: 'inline-block'
              }}>
                {bundle.current_status || 'UNKNOWN'}
              </div>
              <button 
                onClick={() => setShowEditModal(true)}
                style={{ display: 'block', width: '100%', padding: '8px', backgroundColor: 'white', color: '#007bff', border: '1px solid #007bff', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
              >
                Edit Tag
              </button>
            </div>
          </div>
        </div>
      )}
      
      {!bundle && !loading && (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔍</div>
          <h3>Tag lookup results will appear here.</h3>
          <p>Scan or type a Tag number to begin.</p>
        </div>
      )}

      {/* The Unified Edit Modal */}
      {showEditModal && bundle && (
        <InventoryEditModal 
          bundle={bundle} 
          isTest={isTest} 
          onClose={() => setShowEditModal(false)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
