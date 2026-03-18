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
      .from('status_history_view')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('updated_at', { ascending: false });

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
          notes: notes, // Include notes in the insert
        }
      ]);

    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      setNewStatusId('');
      setNotes(''); // Clear notes field on success
      fetchData(); // Refresh history list
    }
    setUpdating(false);
  };

  if (!inventoryId) return null;

  const modalStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
  const contentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '85%', overflowY: 'auto' };
  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <h3>History for Tag #{tag}</h3>

        <div style={{ backgroundColor: '#f1f3f5', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #dee2e6' }}>
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
              style={{ padding: '8px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {updating ? 'Updating...' : 'Update'}
            </button>
          </div>
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Notes (Optional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        </div>

        {loading && <p>Loading history...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={{ padding: '0 10px' }}>
          {history.map((change) => (
            <div key={change.id} style={{ borderLeft: '3px solid #007bff', paddingLeft: '15px', marginBottom: '15px', position: 'relative' }}>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Status: {change.status_name}</p>
              {change.notes && <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', backgroundColor: '#e9ecef', padding: '5px 8px', borderRadius: '4px' }}><strong>Note:</strong> {change.notes}</p>}
              <p style={{ margin: '0', fontSize: '0.8em', color: '#666' }}>
                By: {change.updater_name} at {formatDate(change.updated_at)}
              </p>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}
