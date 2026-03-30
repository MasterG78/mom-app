import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { startOfWeek, endOfWeek, subWeeks, isWithinInterval, format, parseISO } from 'date-fns';

export default function ProductionReport() {
  const [reportData, setReportData] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Filters ---
  const [lineFilter, setLineFilter] = useState('All');
  const [dateRange, setDateRange] = useState('This Week');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // 1. Fetch the Report View
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

      // 2. Fetch Production Goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('production_goals')
        .select('*');

      if (goalsError) {
        console.error('Error fetching goals:', goalsError);
      } else {
        setGoals(goalsData || []);
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
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

    data = data.filter(item => {
      if (!item.produced) return false;

      // Parse the 'YYYY-MM-DD' part to avoid timezone shifts during filtering
      const datePart = item.produced.split('T')[0];
      const [year, month, dayNum] = datePart.split('-').map(Number);
      const prodDate = new Date(year, month - 1, dayNum);

      if (dateRange === 'This Week') {
        return isWithinInterval(prodDate, { start: thisWeekStart, end: thisWeekEnd });
      }
      if (dateRange === 'Last Week') {
        return isWithinInterval(prodDate, { start: lastWeekStart, end: lastWeekEnd });
      }
      return true;
    });

    // 3. Group by Line and then by Day
    const lineSummaries = {};
    let grandTotal = 0;
    let grandTotalGoal = 0;

    data.forEach(item => {
      if (!item.produced) return;

      // Parse the 'YYYY-MM-DD' part of the ISO string to avoid timezone shifts
      // item.produced is "2026-02-23T00:00:00+00:00"
      const datePart = item.produced.split('T')[0];
      const [year, month, dayNum] = datePart.split('-').map(Number);

      // Create a date object in local time for that specific calendar day
      const producedDate = new Date(year, month - 1, dayNum);
      const day = format(producedDate, 'MM/dd/yyyy');
      const dow = producedDate.getDay(); // 0=Sunday, 1=Monday...
      const line = item.line || 'Unknown';
      const value = parseFloat(item.total_value) || 0;

      if (!lineSummaries[line]) {
        lineSummaries[line] = { daily: {}, lineTotal: 0, lineGoal: 0 };
      }
      if (!lineSummaries[line].daily[day]) {
        // Find goal for this line and day of week
        const matchedGoal = goals.find(g => String(g.line) === String(line) && Number(g.day_of_week) === Number(dow));
        const goalValue = matchedGoal ? parseFloat(matchedGoal.goal_value) : 0;

        lineSummaries[line].daily[day] = { value: 0, goal: goalValue };
        lineSummaries[line].lineGoal += goalValue;
        grandTotalGoal += goalValue;
      }
      lineSummaries[line].daily[day].value += value;
      lineSummaries[line].lineTotal += value;
      grandTotal += value;
    });

    // 4. Flatten for rendering
    const result = [];
    const sortedLines = Object.keys(lineSummaries).sort();

    sortedLines.forEach(line => {
      result.push({ isLineHeader: true, label: `Line ${line}` });
      const lineData = lineSummaries[line];
      const sortedDays = Object.keys(lineData.daily).sort((a, b) => new Date(a) - new Date(b));

      sortedDays.forEach(day => {
        const dayData = lineData.daily[day];
        result.push({
          isDateRow: true,
          date: day,
          value: dayData.value,
          goal: dayData.goal,
          diff: dayData.value - dayData.goal
        });
      });

      result.push({
        isLineTotal: true,
        label: `Line ${line} Total`,
        value: lineData.lineTotal,
        goal: lineData.lineGoal,
        diff: lineData.lineTotal - lineData.lineGoal
      });
    });

    if (result.length > 0) {
      result.push({
        isGrandTotal: true,
        label: 'GRAND TOTAL',
        value: grandTotal,
        goal: grandTotalGoal,
        diff: grandTotal - grandTotalGoal
      });
    }

    return result;
  }, [reportData, goals, lineFilter, dateRange]);

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
    .text-success { color: #28a745; }
    .text-danger { color: #dc3545; }
    .diff-col { font-weight: bold; }
  `;

  if (loading) return <div style={{ padding: '20px' }}>Loading Production Report...</div>;

  // Function to get the date range string
  const getDateRangeLabel = () => {
    const now = new Date();
    if (dateRange === 'This Week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return `For the Week of: ${format(start, 'MM/dd/yyyy')} - ${format(end, 'MM/dd/yyyy')}`;
    }
    if (dateRange === 'Last Week') {
      const start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return `For the Week of: ${format(start, 'MM/dd/yyyy')} - ${format(end, 'MM/dd/yyyy')}`;
    }
    return '';
  }

  const formatCurrency = (val) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getDiffStyle = (diff) => diff >= 0 ? 'text-success' : 'text-danger';

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
            <th style={{ textAlign: 'right' }}>Goal ($)</th>
            <th style={{ textAlign: 'right' }}>Difference ($)</th>
          </tr>
        </thead>
        <tbody>
          {processedReport.length > 0 ? processedReport.map((row, idx) => {
            if (row.isLineHeader) return (
              <tr key={idx} style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                <td colSpan="4">{row.label}</td>
              </tr>
            );
            if (row.isDateRow) return (
              <tr key={idx}>
                <td style={{ paddingLeft: '25px' }}>{row.date}</td>
                <td style={{ textAlign: 'right' }}>${formatCurrency(row.value)}</td>
                <td style={{ textAlign: 'right' }}>${formatCurrency(row.goal)}</td>
                <td style={{ textAlign: 'right' }} className={`diff-col ${getDiffStyle(row.diff)}`}>
                  {row.diff > 0 ? '+' : ''}${formatCurrency(row.diff)}
                </td>
              </tr>
            );
            if (row.isLineTotal) return (
              <tr key={idx} className="line-total-row">
                <td style={{ textAlign: 'right' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>${formatCurrency(row.value)}</td>
                <td style={{ textAlign: 'right' }}>${formatCurrency(row.goal)}</td>
                <td style={{ textAlign: 'right' }} className={`diff-col ${getDiffStyle(row.diff)}`}>
                  {row.diff > 0 ? '+' : ''}${formatCurrency(row.diff)}
                </td>
              </tr>
            );
            if (row.isGrandTotal) return (
              <tr key="grand" className="grand-total-row">
                <td style={{ textAlign: 'right' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>${formatCurrency(row.value)}</td>
                <td style={{ textAlign: 'right' }}>${formatCurrency(row.goal)}</td>
                <td style={{ textAlign: 'right' }} className={`diff-col ${getDiffStyle(row.diff)}`}>
                  {row.diff > 0 ? '+' : ''}${formatCurrency(row.diff)}
                </td>
              </tr>
            );
            return null;
          }) : (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No production records found for these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
