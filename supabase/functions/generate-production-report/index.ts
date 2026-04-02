import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Helpers ────────────────────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - (day === 0 ? 6 : day - 1); // Monday start
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

function isWithinInterval(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayET(): Date {
  // Get current time in Eastern Time (UTC-5, ignoring DST per user request)
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const etMs = utcMs - 5 * 60 * 60_000; // fixed UTC-5
  return new Date(etMs);
}

// ── Data processing (mirrors Production.jsx logic) ─────────────────────
interface ReportRow {
  produced: string;
  line: string;
  current_status: string;
  total_value: string | number;
}
interface Goal {
  line: string;
  day_of_week: number;
  goal_value: string | number;
}

interface ProcessedRow {
  isLineHeader?: boolean;
  isDateRow?: boolean;
  isLineTotal?: boolean;
  isGrandTotal?: boolean;
  label?: string;
  date?: string;
  value: number;
  goal: number;
  diff: number;
}

function processReport(reportData: ReportRow[], goals: Goal[]): { rows: ProcessedRow[]; weekLabel: string } {
  const now = todayET();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const weekLabel = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

  // Filter: exclude Void, "This Week" only
  let data = reportData.filter((item) => item.current_status !== "Void");

  data = data.filter((item) => {
    if (!item.produced) return false;
    const datePart = item.produced.split("T")[0];
    const [year, month, dayNum] = datePart.split("-").map(Number);
    const prodDate = new Date(year, month - 1, dayNum);
    return isWithinInterval(prodDate, weekStart, weekEnd);
  });

  // Group by Line → Day
  const lineSummaries: Record<string, {
    daily: Record<string, { value: number; goal: number }>;
    lineTotal: number;
    lineGoal: number;
  }> = {};
  let grandTotal = 0;
  let grandTotalGoal = 0;

  data.forEach((item) => {
    if (!item.produced) return;
    const datePart = item.produced.split("T")[0];
    const [year, month, dayNum] = datePart.split("-").map(Number);
    const producedDate = new Date(year, month - 1, dayNum);
    const day = formatDate(producedDate);
    const dow = producedDate.getDay();
    const line = item.line || "Unknown";
    const value = parseFloat(String(item.total_value)) || 0;

    if (!lineSummaries[line]) {
      lineSummaries[line] = { daily: {}, lineTotal: 0, lineGoal: 0 };
    }
    if (!lineSummaries[line].daily[day]) {
      const matchedGoal = goals.find(
        (g) => String(g.line) === String(line) && Number(g.day_of_week) === Number(dow)
      );
      const goalValue = matchedGoal ? parseFloat(String(matchedGoal.goal_value)) : 0;
      lineSummaries[line].daily[day] = { value: 0, goal: goalValue };
      lineSummaries[line].lineGoal += goalValue;
      grandTotalGoal += goalValue;
    }
    lineSummaries[line].daily[day].value += value;
    lineSummaries[line].lineTotal += value;
    grandTotal += value;
  });

  // Flatten for rendering
  const rows: ProcessedRow[] = [];
  const sortedLines = Object.keys(lineSummaries).sort();

  sortedLines.forEach((line) => {
    rows.push({ isLineHeader: true, label: `Line ${line}`, value: 0, goal: 0, diff: 0 });
    const lineData = lineSummaries[line];
    const sortedDays = Object.keys(lineData.daily).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    sortedDays.forEach((day) => {
      const d = lineData.daily[day];
      rows.push({
        isDateRow: true,
        date: day,
        value: d.value,
        goal: d.goal,
        diff: d.value - d.goal,
      });
    });

    rows.push({
      isLineTotal: true,
      label: `Line ${line} Total`,
      value: lineData.lineTotal,
      goal: lineData.lineGoal,
      diff: lineData.lineTotal - lineData.lineGoal,
    });
  });

  if (rows.length > 0) {
    rows.push({
      isGrandTotal: true,
      label: "GRAND TOTAL",
      value: grandTotal,
      goal: grandTotalGoal,
      diff: grandTotal - grandTotalGoal,
    });
  }

  return { rows, weekLabel };
}

// ── HTML Report Builder ────────────────────────────────────────────────
function buildHtmlReport(rows: ProcessedRow[], weekLabel: string, dateStr: string): string {
  const diffColor = (diff: number) => (diff >= 0 ? "#28a745" : "#dc3545");
  const diffPrefix = (diff: number) => (diff > 0 ? "+" : "");

  let tableRows = "";

  if (rows.length === 0) {
    tableRows = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">No production records found for this week.</td></tr>`;
  } else {
    rows.forEach((row) => {
      if (row.isLineHeader) {
        tableRows += `<tr style="background-color:#e9ecef;font-weight:bold;">
          <td colspan="4" style="padding:8px 12px;font-size:14px;">${row.label}</td></tr>`;
      } else if (row.isDateRow) {
        tableRows += `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:6px 12px 6px 30px;">${row.date}</td>
          <td style="text-align:right;padding:6px 12px;">$${formatCurrency(row.value)}</td>
          <td style="text-align:right;padding:6px 12px;">$${formatCurrency(row.goal)}</td>
          <td style="text-align:right;padding:6px 12px;font-weight:bold;color:${diffColor(row.diff)};">${diffPrefix(row.diff)}$${formatCurrency(row.diff)}</td></tr>`;
      } else if (row.isLineTotal) {
        tableRows += `<tr style="background-color:#f8f9fa;font-weight:bold;border-top:1px solid #ccc;">
          <td style="text-align:right;padding:8px 12px;">${row.label}</td>
          <td style="text-align:right;padding:8px 12px;">$${formatCurrency(row.value)}</td>
          <td style="text-align:right;padding:8px 12px;">$${formatCurrency(row.goal)}</td>
          <td style="text-align:right;padding:8px 12px;font-weight:bold;color:${diffColor(row.diff)};">${diffPrefix(row.diff)}$${formatCurrency(row.diff)}</td></tr>`;
      } else if (row.isGrandTotal) {
        tableRows += `<tr style="background-color:#2d5016;color:#fff;font-weight:900;font-size:14px;border-top:3px solid #1a3a0a;">
          <td style="text-align:right;padding:10px 12px;">${row.label}</td>
          <td style="text-align:right;padding:10px 12px;">$${formatCurrency(row.value)}</td>
          <td style="text-align:right;padding:10px 12px;">$${formatCurrency(row.goal)}</td>
          <td style="text-align:right;padding:10px 12px;color:${row.diff >= 0 ? '#a8e6a0' : '#ff9999'};">${diffPrefix(row.diff)}$${formatCurrency(row.diff)}</td></tr>`;
      }
    });
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background:#f5f5f0; }
  .container { max-width:700px; margin:0 auto; background:#fff; }
  .header { background: linear-gradient(135deg, #2d5016 0%, #4a7c28 100%); color:#fff; padding:25px 30px; text-align:center; }
  .header h1 { margin:0 0 5px 0; font-size:22px; letter-spacing:1px; }
  .header p { margin:0; font-size:13px; opacity:0.9; }
  .subheader { background:#f8f9fa; padding:12px 30px; text-align:center; font-size:13px; color:#555; border-bottom:2px solid #e9ecef; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#3a6b1e; color:#fff; text-align:left; padding:10px 12px; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }
  .footer { background:#f8f9fa; padding:15px 30px; text-align:center; font-size:11px; color:#888; border-top:2px solid #e9ecef; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 Mountain Oak Mill</h1>
      <p>Daily Production Report</p>
    </div>
    <div class="subheader">
      <strong>For the Week of: ${weekLabel}</strong><br/>
      Report generated: ${dateStr}
    </div>
    <table>
      <thead>
        <tr>
          <th>Line / Date</th>
          <th style="text-align:right;">Total Value ($)</th>
          <th style="text-align:right;">Goal ($)</th>
          <th style="text-align:right;">Difference ($)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <div class="footer">
      Mountain Oak Mill &bull; Automated Production Report<br/>
      This report is generated automatically at 8:00 PM ET (Sun-Thu).
    </div>
  </div>
</body>
</html>`;
}

// ── HTML-to-PDF via print-style rendering ──────────────────────────────
// Supabase Edge Functions run Deno — we use jsPDF for lightweight PDF
// generation without a headless browser.
async function htmlTableToPdf(rows: ProcessedRow[], weekLabel: string, dateStr: string): Promise<Uint8Array> {
  const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
  const autoTable = (await import("https://esm.sh/jspdf-autotable@3.8.4")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Header ──
  doc.setFillColor(45, 80, 22); // Dark green
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Mountain Oak Mill", 105, 14, { align: "center" });
  doc.setFontSize(11);
  doc.text("Daily Production Report", 105, 22, { align: "center" });

  // ── Subheader ──
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text(`For the Week of: ${weekLabel}`, 105, 38, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Report generated: ${dateStr}`, 105, 44, { align: "center" });

  // ── Build table data ──
  const tableHead = [["Line / Date", "Total Value ($)", "Goal ($)", "Difference ($)"]];
  const tableBody: (string | { content: string; styles: Record<string, unknown> })[][] = [];

  rows.forEach((row) => {
    if (row.isLineHeader) {
      tableBody.push([
        { content: row.label || "", styles: { fontStyle: "bold", fillColor: [233, 236, 239], cellWidth: "auto" } },
        { content: "", styles: { fillColor: [233, 236, 239] } },
        { content: "", styles: { fillColor: [233, 236, 239] } },
        { content: "", styles: { fillColor: [233, 236, 239] } },
      ]);
    } else if (row.isDateRow) {
      const diffColor: [number, number, number] = row.diff >= 0 ? [40, 167, 69] : [220, 53, 69];
      const prefix = row.diff > 0 ? "+" : "";
      tableBody.push([
        { content: `    ${row.date}`, styles: {} },
        { content: `$${formatCurrency(row.value)}`, styles: { halign: "right" } },
        { content: `$${formatCurrency(row.goal)}`, styles: { halign: "right" } },
        { content: `${prefix}$${formatCurrency(row.diff)}`, styles: { halign: "right", textColor: diffColor, fontStyle: "bold" } },
      ]);
    } else if (row.isLineTotal) {
      const diffColor: [number, number, number] = row.diff >= 0 ? [40, 167, 69] : [220, 53, 69];
      const prefix = row.diff > 0 ? "+" : "";
      tableBody.push([
        { content: row.label || "", styles: { halign: "right", fontStyle: "bold", fillColor: [248, 249, 250] } },
        { content: `$${formatCurrency(row.value)}`, styles: { halign: "right", fontStyle: "bold", fillColor: [248, 249, 250] } },
        { content: `$${formatCurrency(row.goal)}`, styles: { halign: "right", fontStyle: "bold", fillColor: [248, 249, 250] } },
        { content: `${prefix}$${formatCurrency(row.diff)}`, styles: { halign: "right", fontStyle: "bold", textColor: diffColor, fillColor: [248, 249, 250] } },
      ]);
    } else if (row.isGrandTotal) {
      const diffColor: [number, number, number] = row.diff >= 0 ? [168, 230, 160] : [255, 153, 153];
      const prefix = row.diff > 0 ? "+" : "";
      tableBody.push([
        { content: row.label || "", styles: { halign: "right", fontStyle: "bold", fillColor: [45, 80, 22], textColor: [255, 255, 255] } },
        { content: `$${formatCurrency(row.value)}`, styles: { halign: "right", fontStyle: "bold", fillColor: [45, 80, 22], textColor: [255, 255, 255] } },
        { content: `$${formatCurrency(row.goal)}`, styles: { halign: "right", fontStyle: "bold", fillColor: [45, 80, 22], textColor: [255, 255, 255] } },
        { content: `${prefix}$${formatCurrency(row.diff)}`, styles: { halign: "right", fontStyle: "bold", fillColor: [45, 80, 22], textColor: diffColor } },
      ]);
    }
  });

  // deno-lint-ignore no-explicit-any
  autoTable(doc as any, {
    startY: 50,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [58, 107, 30],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 40, halign: "right" },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });

  // ── Footer ──
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text(
    "Mountain Oak Mill • Automated Production Report • Generated daily at 8:00 PM ET",
    105,
    pageHeight - 10,
    { align: "center" }
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ── Main Handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    // Allow CORS for manual testing
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // ── Environment ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailTo = Deno.env.get("REPORT_EMAIL_TO") || "greg@mountainoakmill.com";
    const emailFrom = Deno.env.get("REPORT_EMAIL_FROM") || "Mountain Oak Mill Reports <onboarding@resend.dev>";
    const replyTo = Deno.env.get("REPORT_REPLY_TO") || "greg@mountainoakmill.com";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Supabase client (service role for server-side access) ──
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Fetch data
    const { data: reportData, error: reportError } = await supabase
      .from("inventory_report_view")
      .select("*")
      .order("produced", { ascending: false });

    if (reportError) {
      throw new Error(`Failed to fetch report data: ${reportError.message}`);
    }

    const { data: goalsData, error: goalsError } = await supabase
      .from("production_goals")
      .select("*");

    if (goalsError) {
      throw new Error(`Failed to fetch goals: ${goalsError.message}`);
    }

    // 2. Process data (mirrors Production.jsx logic)
    const { rows, weekLabel } = processReport(reportData || [], goalsData || []);

    // 3. Generate date string for the email subject
    const now = todayET();
    const dateStr = formatDate(now);

    // 4. Generate PDF
    const pdfBytes = await htmlTableToPdf(rows, weekLabel, dateStr);
    const pdfBase64 = btoa(
      String.fromCharCode(...new Uint8Array(pdfBytes))
    );

    // 5. Build branded HTML email body
    const emailHtml = buildHtmlReport(rows, weekLabel, dateStr);

    // 6. Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [emailTo],
        reply_to: replyTo,
        subject: `Mountain Oak Mill — Daily Production Report — ${dateStr}`,
        html: emailHtml,
        attachments: [
          {
            filename: `Production_Report_${dateStr.replace(/\//g, "-")}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendResult)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Report sent to ${emailTo}`,
        resend_id: resendResult.id,
        week: weekLabel,
        rows_in_report: rows.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating production report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
