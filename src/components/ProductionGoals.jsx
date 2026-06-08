import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ProductionGoals({ effectiveRole }) {
  const [lines, setLines] = useState([]);
  const [goalMap, setGoalMap] = useState({});
  const [originalLines, setOriginalLines] = useState([]);
  const [originalGoalMap, setOriginalGoalMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [toast, setToast] = useState({ message: '', type: '' });

  const isAdmin = effectiveRole === 'admin';

  // Fetch production goals from Supabase
  const fetchGoals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_goals')
        .select('*');

      if (error) {
        throw error;
      }

      // Extract unique sorted lines
      const uniqueLines = Array.from(new Set(data.map(g => g.line))).sort();

      // Construct mapping: day_of_week -> line -> goal_value
      const map = {};
      for (let d = 0; d < 7; d++) {
        map[d] = {};
        uniqueLines.forEach(line => {
          map[d][line] = 0;
        });
      }

      data.forEach(g => {
        if (map[g.day_of_week] !== undefined) {
          map[g.day_of_week][g.line] = Number(g.goal_value);
        }
      });

      setLines(uniqueLines);
      setGoalMap(map);
      setOriginalLines([...uniqueLines]);
      setOriginalGoalMap(JSON.parse(JSON.stringify(map)));
    } catch (err) {
      console.error('Error fetching production goals:', err);
      showToast('Error loading production goals.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  const handleGoalChange = (dayIndex, line, value) => {
    if (!isAdmin) return;
    
    // Clean value: allow empty string for typing, otherwise parse it
    setGoalMap(prev => {
      const updated = { ...prev };
      updated[dayIndex] = { ...updated[dayIndex] };
      updated[dayIndex][line] = value;
      return updated;
    });
  };

  const handleAddLine = (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const trimmed = newLineName.trim().toUpperCase();
    if (!trimmed) {
      showToast('Line name cannot be empty.', 'error');
      return;
    }

    if (lines.includes(trimmed)) {
      showToast(`Line "${trimmed}" already exists in the grid.`, 'error');
      return;
    }

    // Add to line list and sort alphabetically
    const newLines = [...lines, trimmed].sort();
    setLines(newLines);

    // Initialize goals for the new line to 0 for all days
    setGoalMap(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      for (let d = 0; d < 7; d++) {
        if (updated[d][trimmed] === undefined) {
          updated[d][trimmed] = 0;
        }
      }
      return updated;
    });

    setNewLineName('');
    showToast(`Added line "${trimmed}" to the grid. Click Save to persist.`, 'info');
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);

    try {
      const upsertData = [];
      for (let d = 0; d < 7; d++) {
        for (const line of lines) {
          const rawVal = goalMap[d][line];
          // Treat empty or invalid inputs as 0
          const numericVal = parseFloat(rawVal) || 0;

          if (numericVal < 0) {
            throw new Error(`Goal values cannot be negative. Found: ${rawVal} for ${DAYS[d]} Line ${line}`);
          }

          upsertData.push({
            day_of_week: d,
            line: line,
            goal_value: numericVal
          });
        }
      }

      const { error } = await supabase
        .from('production_goals')
        .upsert(upsertData, { onConflict: 'day_of_week,line' });

      if (error) throw error;

      showToast('Production goals saved successfully!');
      setOriginalLines([...lines]);
      setOriginalGoalMap(JSON.parse(JSON.stringify(goalMap)));
    } catch (err) {
      console.error('Error saving production goals:', err);
      showToast(err.message || 'Error saving production goals.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setLines([...originalLines]);
    setGoalMap(JSON.parse(JSON.stringify(originalGoalMap)));
    showToast('Changes discarded.', 'info');
  };

  // Check if grid has changes
  const hasChanges = JSON.stringify(lines) !== JSON.stringify(originalLines) || 
                     JSON.stringify(goalMap) !== JSON.stringify(originalGoalMap);

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#007bff', fontSize: '18px', fontWeight: 'bold' }}>
        <div className="spinner"></div>
        Loading Production Goals...
      </div>
    );
  }

  return (
    <div className="goals-container">
      {/* Toast Alert */}
      {toast.message && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Styled Header */}
      <div className="goals-header">
        <div>
          <h2>Manage Production Goals</h2>
          <p className="subtitle">Set daily targets in dollars ($) for each production line</p>
        </div>
        {!isAdmin && (
          <div className="role-badge read-only-badge">
            <span className="badge-icon">🔒</span> View Only Mode (Admin Only Edit)
          </div>
        )}
        {isAdmin && (
          <div className="role-badge admin-badge">
            <span className="badge-icon">⚡</span> Admin Edit Mode
          </div>
        )}
      </div>

      <div className="goals-content-layout">
        {/* Main Grid Card */}
        <div className="goals-card grid-card">
          <div className="table-responsive">
            <table className="goals-table">
              <thead>
                <tr>
                  <th className="day-column-header">Day of Week</th>
                  {lines.map(line => (
                    <th key={line} className="line-column-header">
                      Line {line}
                    </th>
                  ))}
                  {lines.length === 0 && <th>No Production Lines Configured</th>}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((dayName, dIdx) => (
                  <tr key={dayName} className="row-hover">
                    <td className="day-name-cell">{dayName}</td>
                    {lines.map(line => {
                      const val = goalMap[dIdx]?.[line] ?? 0;
                      return (
                        <td key={line} className="input-cell">
                          {isAdmin ? (
                            <div className="input-wrapper">
                              <span className="currency-prefix">$</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={val === 0 && typeof val === 'number' ? '' : val}
                                placeholder="0"
                                onChange={(e) => handleGoalChange(dIdx, line, e.target.value)}
                                className="goal-input"
                              />
                            </div>
                          ) : (
                            <span className="read-only-value">${formatCurrency(val)}</span>
                          )}
                        </td>
                      );
                    })}
                    {lines.length === 0 && (
                      <td style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                        Please add a line to configure goals.
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form Actions */}
          {isAdmin && (
            <div className="form-actions">
              <button 
                onClick={handleDiscard} 
                disabled={!hasChanges || saving} 
                className="btn btn-secondary"
              >
                Discard Changes
              </button>
              <button 
                onClick={handleSave} 
                disabled={!hasChanges || saving} 
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Goals'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar / Options Panel */}
        {isAdmin && (
          <div className="goals-card sidebar-card">
            <h3>Add Production Line</h3>
            <p className="card-description">
              Enter a line identifier to add it as a new column to the goals table.
            </p>
            <form onSubmit={handleAddLine} className="add-line-form">
              <input
                type="text"
                maxLength={10}
                placeholder="e.g. D, R, LINE-1"
                value={newLineName}
                onChange={(e) => setNewLineName(e.target.value)}
                className="add-line-input"
              />
              <button type="submit" className="btn btn-add">
                Add Column
              </button>
            </form>
          </div>
        )}
      </div>

      <style>{`
        .goals-container {
          padding: 10px 0;
          animation: fadeIn 0.4s ease-out;
        }
        
        .goals-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .goals-header h2 {
          margin: 0 0 5px 0;
          color: #1e293b;
          font-size: 24px;
          font-weight: 700;
        }

        .subtitle {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .role-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .read-only-badge {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .admin-badge {
          background-color: #f0fdf4;
          color: #166534;
          border: 1px solid #dcfce7;
        }

        .badge-icon {
          font-size: 14px;
        }

        .goals-content-layout {
          display: flex;
          gap: 25px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .goals-card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
          border: 1px solid #e2e8f0;
          padding: 24px;
        }

        .grid-card {
          flex: 3;
          min-width: 300px;
        }

        .sidebar-card {
          flex: 1;
          min-width: 260px;
          max-width: 320px;
        }

        .sidebar-card h3 {
          margin: 0 0 10px 0;
          font-size: 18px;
          color: #1e293b;
          font-weight: 600;
        }

        .card-description {
          margin: 0 0 20px 0;
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }

        .table-responsive {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          margin-bottom: 20px;
        }

        .goals-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          text-align: left;
        }

        .goals-table th {
          background-color: #f8fafc;
          padding: 14px 16px;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }

        .day-column-header {
          width: 150px;
        }

        .line-column-header {
          min-width: 110px;
          text-align: center;
        }

        .goals-table td {
          padding: 10px 16px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .day-name-cell {
          font-weight: 600;
          color: #334155;
          background-color: #f8fafc;
        }

        .row-hover:hover {
          background-color: #f8fafc;
        }

        .input-cell {
          text-align: center;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          background-color: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 0 8px;
          transition: all 0.2s ease;
          width: 110px;
          margin: 0 auto;
        }

        .input-wrapper:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
          background-color: #ffffff;
        }

        .currency-prefix {
          color: #94a3b8;
          font-weight: 500;
          user-select: none;
          font-size: 13px;
        }

        .goal-input {
          border: none;
          background: transparent;
          padding: 8px 4px;
          width: 100%;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          text-align: right;
        }

        .goal-input:focus {
          outline: none;
        }

        .read-only-value {
          font-weight: 500;
          color: #475569;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }

        .btn {
          font-size: 14px;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 6px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: #3b82f6;
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .btn-secondary {
          background-color: #ffffff;
          border-color: #cbd5e1;
          color: #475569;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #f8fafc;
          border-color: #94a3b8;
        }

        .add-line-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .add-line-input {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .add-line-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .btn-add {
          background-color: #0f172a;
          color: #ffffff;
          width: 100%;
        }

        .btn-add:hover {
          background-color: #1e293b;
        }

        /* Toast notifications */
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 24px;
          border-radius: 8px;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
          z-index: 9999;
          animation: slideIn 0.3s ease-out;
        }

        .toast-success {
          background-color: #10b981;
        }

        .toast-error {
          background-color: #ef4444;
        }

        .toast-info {
          background-color: #3b82f6;
        }

        /* Spinner */
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #007bff;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          margin: 10px auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
