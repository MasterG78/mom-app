import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

export default function ProductionReport() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- Filters ---
  const [lineFilter, setLineFilter] = useState('All');
  const [dateRange, setDateRange] = useState('This Week');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // 2. Fetch the Report View
      const { data, error } = await supabase
        .from('inventory_report_view') 
        .select('*')
        .order('produced', { ascending: false });

      if (error) {
        console.error('Error fetching view:', error);
        alert('Error loading report view.');
      } else {
        setReportData(data || []);
      }
      setLoading(false);
    }
    fetchData();
  }, []);


  const processedReport = useMemo(() => {
    let data = [...reportData];

    // Exclude Void items from report totals
    data = data.filter(item => item.current_status !== 'Void');

    // 1. Line Filter
    if (lineFilter !== 'All') {
      data = data.filter(item => item.line === lineFilter);
    }

    // 2. Date Range Filter
    const now = new Date();
    const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    data = data.filter(item => {
      if (!item.produced) return false;
      const prodDate = new Date(item.produced);

      if (dateRange === 'This Week') {
        const monday = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        monday.setDate(diff);
        return prodDate >= getStartOfDay(monday);
      }
      if (dateRange === 'Last Week') {
        const lastMonday = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
        lastMonday.setDate(diff);
        const thisMonday = new Date(now);
        const thisDiff = now.getDate() - day + (day === 0 ? -6 : 1);
        thisMonday.setDate(thisDiff);
        return prodDate >= getStartOfDay(lastMonday) && prodDate < getStartOfDay(thisMonday);
      }
      return true; // Should not happen with the current UI
    });

    // 3. Group by Line and then by Day
    const lineSummaries = {};
    let grandTotal = 0;

    data.forEach(item => {
      const day = new Date(item.produced).toLocaleDateString();
      const line = item.line || 'Unknown';
      const value = parseFloat(item.total_value) || 0;

      if (!lineSummaries[line]) {
        lineSummaries[line] = { daily: {}, lineTotal: 0 };
      }
      if (!lineSummaries[line].daily[day]) {
        lineSummaries[line].daily[day] = 0;
      }
      lineSummaries[line].daily[day] += value;
      lineSummaries[line].lineTotal += value;
      grandTotal += value;
    });

    // 4. Flatten for rendering
    const result = [];
    const sortedLines = Object.keys(lineSummaries).sort();

    sortedLines.forEach(line => {
      result.push({ isLineHeader: true, label: `Line ${line}` });
      const lineData = lineSummaries[line];
      const sortedDays = Object.keys(lineData.daily).sort((a,b) => new Date(b) - new Date(a));
      
      sortedDays.forEach(day => {
        result.push({ isDateRow: true, date: day, value: lineData.daily[day] });
      });

      result.push({ isLineTotal: true, label: `Line ${line} Total`, value: lineData.lineTotal });
    });
    
    if (result.length > 0) {
      result.push({ isGrandTotal: true, label: 'GRAND TOTAL', value: grandTotal });
    }

    return result;
  }, [reportData, lineFilter, dateRange]);

  const reportStyles = `
    .print-only { display: none; }
    @media print { 
      .no-print { display: none !important; } 
      .print-only { display: block; text-align: center; margin-bottom: 20px; }
      @page { size: auto;  margin: 15mm; }
      body { margin: 0; }
    }
    .report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .report-table th { border-bottom: 2px solid #333; text-align: left; padding: 4px; }
    .report-table td { padding: 3px 4px; border-bottom: 1px solid #eee; }
    .line-total-row { background-color: #f8f9fa; font-weight: bold; border-top: 1px solid #ccc; }
    .grand-total-row { background-color: #e9ecef; font-weight: 900; font-size: 13px; border-top: 2px solid #000; }
    .filter-group { display: flex; flexDirection: column; gap: 2px; }
    .filter-label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; }
  `;

  if (loading) return <div style={{ padding: '20px' }}>Loading Report View...</div>;

  // Function to get the date range string
  const getDateRangeLabel = () => {
    if (dateRange === 'This Week') {
      const now = new Date();
      const monday = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `For the Week of: ${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
    }
    if (dateRange === 'Last Week') {
      const now = new Date();
      const lastMonday = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      lastMonday.setDate(diff);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return `For the Week of: ${lastMonday.toLocaleDateString()} - ${lastSunday.toLocaleDateString()}`;
    }
    return '';
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff' }}>
      <style>{reportStyles}</style>

      <div className="print-only">
        <h1>Production Report</h1>
        <p>{getDateRangeLabel()}</p>
      </div>
      
      <div className="no-print" style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ marginBottom: '15px' }}>Production Report</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          
          <div className="filter-group">
            <label className="filter-label">Line</label>
            <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} style={{ padding: '5px' }}>
              <option value="All">All Lines</option>
              {['A', 'B', 'C', 'D', 'P', 'R'].map(l => <option key={l} value={l}>Line {l}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Timeframe</label>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '5px' }}>
              <option value="This Week">This Week</option>
              <option value="Last Week">Last Week</option>
            </select>
          </div>

          <button onClick={() => window.print()} style={{ padding: '6px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Print Report
          </button>
        </div>
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>Line / Date</th>
            <th style={{ textAlign: 'right' }}>Total Value ($)</th>
          </tr>
        </thead>
        <tbody>
          {processedReport.length > 0 ? processedReport.map((row, idx) => {
            if (row.isLineHeader) return (
              <tr key={idx} style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                <td colSpan="2">{row.label}</td>
              </tr>
            );
            if (row.isDateRow) return (
              <tr key={idx}>
                <td style={{ paddingLeft: '25px' }}>{row.date}</td>
                <td style={{ textAlign: 'right' }}>${row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            );
            if (row.isLineTotal) return (
              <tr key={idx} className="line-total-row">
                <td style={{ textAlign: 'right' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>${row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            );
            if (row.isGrandTotal) return (
              <tr key="grand" className="grand-total-row">
                <td style={{ textAlign: 'right' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>${row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            );
            return null;
          }) : (
             <tr><td colSpan="2" style={{ textAlign: 'center', padding: '20px' }}>No production records found for these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}