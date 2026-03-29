import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export default function StatusHistoryModal({ inventoryId, tag, onClose }) {
  const [history, setHistory] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [newStatusId, setNewStatusId] = useState('');
  const [notes, setNotes] = useState(''); // New state for the notes
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const historyReq = supabase
      .from('unified_inventory_history_view')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('event_at', { ascending: false });

    const statusReq = supabase
      .from('statuses')
      .select('id, status_name')
      .order('id');

    const [historyRes, statusRes] = await Promise.all([historyReq, statusReq]);

    if (historyRes.error) setError('Failed to load history.');
    else setHistory(historyRes.data);

    if (statusRes.error) console.error('Error loading StatusList');
    else setStatuses(statusRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (inventoryId) fetchData();
  }, [inventoryId]);

  const handleUpdateStatus = async () => {
    if (!newStatusId) return;
    setUpdating(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('status_changes')
      .insert([
        {
          inventory_id: inventoryId,
          status_id: newStatusId,
          updated_by: user.id,
          updated_at: new Date(),
          notes: notes,
        }
      ]);

    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      setNewStatusId('');
      setNotes('');
      fetchData();
    }
    setUpdating(false);
  };

  if (!inventoryId) return null;

  const modalStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
  const contentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '85%', overflowY: 'auto' };
  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  const renderHistoryEntry = (entry) => {
    const isStatus = entry.entry_type === 'status';

    return (
      <div 
        key={entry.id} 
        style={{ 
          borderLeft: `4px solid ${isStatus ? '#007bff' : '#fd7e14'}`, 
          paddingLeft: '15px', 
          marginBottom: '20px', 
          position: 'relative',
          backgroundColor: '#fdfdfd'
        }}
      >
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '1.1em' }}>
          {isStatus ? `Status: ${entry.primary_label}` : `Adjustment: ${entry.primary_label}`}
        </p>

        {isStatus && entry.secondary_label && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', backgroundColor: '#e9ecef', padding: '5px 8px', borderRadius: '4px' }}>
            <strong>Note:</strong> {entry.secondary_label}
          </p>
        )}

        {!isStatus && entry.changed_fields && (
          <div style={{ marginBottom: '8px', fontSize: '0.9em' }}>
            <ul style={{ margin: '5px 0', paddingLeft: '20px', color: '#444' }}>
              {entry.changed_fields.map(field => {
                const oldVal = entry.old_data?.[field];
                const newVal = entry.new_data?.[field];
                
                // Humanize field names
                const fieldLabel = field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

                return (
                  <li key={field}>
                    <strong>{fieldLabel}:</strong> 
                    <span style={{ textDecoration: 'line-through', color: '#999', margin: '0 5px' }}>{oldVal ?? 'none'}</span>
                    → 
                    <span style={{ color: '#28a745', marginLeft: '5px' }}>{newVal ?? 'none'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p style={{ margin: '0', fontSize: '0.8em', color: '#666' }}>
          By: {entry.user_name || 'System'} at {formatDate(entry.event_at)}
        </p>
      </div>
    );
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>History for Tag #{tag}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>

        <div style={{ backgroundColor: '#f1f3f5', padding: '15px', borderRadius: '6px', marginBottom: '25px', border: '1px solid #dee2e6' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Update Status:</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={newStatusId}
              onChange={(e) => setNewStatusId(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">-- Choose New Status --</option>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.status_name}</option>)}
            </select>
            <button
              onClick={handleUpdateStatus}
              disabled={updating || !newStatusId}
              style={{ padding: '8px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {updating ? 'Updating...' : 'Set Status'}
            </button>
          </div>
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Notes (Optional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for change..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
          <h4 style={{ margin: 0, color: '#495057' }}>Events & Adjustments</h4>
        </div>

        {loading && <p>Loading history...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {!loading && history.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No events recorded for this bundle.</p>}

        <div style={{ padding: '0 5px' }}>
          {history.map(renderHistoryEntry)}
        </div>

        <button onClick={onClose} style={{ marginTop: '30px', width: '100%', padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
      </div>
    </div>
  );
}
