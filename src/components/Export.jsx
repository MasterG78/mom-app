// src/Export.jsx
import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { exportInventoryByDate } from '../services/inventoryService';

function Export() {
  const [filterType, setFilterType] = useState('currentYear'); // 'currentYear', 'lastYear', 'custom'
  const [customRange, setCustomRange] = useState();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      await exportInventoryByDate({
        filterType,
        customRange,
      });
    } catch (error) {
      console.error("Export failed:", error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Export Inventory</h2>
      <p>Select a date range and click "Export to CSV" to download the inventory report.</p>
      
      <div className="form-group">
        <label htmlFor="filterType">Date Range</label>
        <select id="filterType" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="currentYear">Current Year</option>
          <option value="lastYear">Last Year</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {filterType === 'custom' && (
        <div className="form-group">
          <label>Custom Date Range</label>
          <DayPicker
            mode="range"
            selected={customRange}
            onSelect={setCustomRange}
          />
        </div>
      )}

      <button onClick={handleExport} disabled={isLoading}>
        {isLoading ? 'Exporting...' : 'Export to CSV'}
      </button>
    </div>
  );
}

export default Export;
