import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import autoTable from "https://esm.sh/jspdf-autotable@3.8.4";

// ── Helpers ────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

function todayET(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const etMs = utcMs - 5 * 60 * 60_000; // fixed UTC-5
  return new Date(etMs);
}

interface WeeklyReportRow {
  week_ending: string;
  "Weekly Revenue": number;
  "Gross Profit": number;
  "Opening Inv": number;
  "Closing Inv": number;
  "Inv Growth %": number;
  "Expected Change": number;
  "Shrinkage/Discrepancy": number;
  "Manual Adjustments": number;
  "Deletions": number;
  notes: string;
}

// ── QuickChart Generator ───────────────────────────────────────────────
function generateChartUrl(rows: WeeklyReportRow[]): string {
  const sortedRows = [...rows].sort((a, b) => new Date(a.week_ending).getTime() - new Date(b.week_ending).getTime());
  
  const labels = sortedRows.map(r => {
    const d = new Date(r.week_ending);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  
  const revenueData = sortedRows.map(r => r["Weekly Revenue"]);
  const inventoryData = sortedRows.map(r => r["Closing Inv"]);

  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Weekly Revenue',
          data: revenueData,
          borderColor: '#2d5016',
          backgroundColor: 'rgba(45, 80, 22, 0.1)',
          yAxisID: 'y',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Inventory Value',
          data: inventoryData,
          borderColor: '#4a7c28',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    },
    options: {
      title: {
        display: true,
        text: '10-Week Trend: Revenue vs Inventory',
        fontSize: 16,
        fontColor: '#333'
      },
      scales: {
        yAxes: [
          {
            id: 'y',
            type: 'linear',
            position: 'left',
            scaleLabel: {
              display: true,
              labelString: 'Revenue ($)',
              fontColor: '#2d5016'
            },
            ticks: {
              beginAtZero: true,
              callback: (val: number) => '$' + val.toLocaleString()
            }
          },
          {
            id: 'y1',
            type: 'linear',
            position: 'right',
            scaleLabel: {
              display: true,
              labelString: 'Inventory ($)',
              fontColor: '#4a7c28'
            },
            ticks: {
              beginAtZero: false,
              callback: (val: number) => '$' + val.toLocaleString()
            },
            gridLines: {
              drawOnChartArea: false
            }
          }
        ]
      }
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=300&bkg=white`;
}

// ── Main Handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailTo = Deno.env.get("REPORT_EMAIL_TO") || "greg@mountainoakmill.com";
    const emailFrom = Deno.env.get("REPORT_EMAIL_FROM") || "Mountain Oak Mill Reports <onboarding@resend.dev>";
    const replyTo = Deno.env.get("REPORT_REPLY_TO") || "greg@mountainoakmill.com";

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch last 10 weeks
    const { data: reportData, error: reportError } = await supabase
      .from("owner_weekly_trend_report")
      .select("*")
      .order("week_ending", { ascending: false })
      .limit(10);

    if (reportError) throw reportError;
    if (!reportData || reportData.length === 0) {
      return new Response(JSON.stringify({ success: false, message: "No data found" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const rows = reportData as WeeklyReportRow[];
    const now = todayET();
    const dateStr = formatDate(now);

    // 1. Generate Chart Image
    const chartUrl = generateChartUrl(rows);
    const chartResponse = await fetch(chartUrl);
    const chartBuffer = await chartResponse.arrayBuffer();
    const chartUint8 = new Uint8Array(chartBuffer);

    // 2. Generate PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Header
    doc.setFillColor(45, 80, 22); // Dark green
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Mountain Oak Mill", 105, 14, { align: "center" });
    doc.setFontSize(11);
    doc.text("Owner Weekly Trend Report", 105, 22, { align: "center" });

    // Subheader
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.text(`Generated on: ${dateStr}`, 105, 38, { align: "center" });

    // Add Chart
    // QuickChart is 600x300, so we maintain 2:1 ratio.
    // 180mm width -> 90mm height
    doc.addImage(chartUint8, "PNG", 15, 45, 180, 90);

    // Table
    const tableHead = [["Week Ending", "Revenue", "Gross Profit", "Closing Inv", "Inv Growth %", "Shrinkage"]];
    const tableBody = rows.map(r => [
      formatDate(new Date(r.week_ending)),
      `$${formatCurrency(r["Weekly Revenue"])}`,
      `$${formatCurrency(r["Gross Profit"])}`,
      `$${formatCurrency(r["Closing Inv"])}`,
      `${r["Inv Growth %"]}%`,
      { 
        content: `$${formatCurrency(r["Shrinkage/Discrepancy"])}`, 
        styles: { textColor: Math.abs(r["Shrinkage/Discrepancy"]) > 100 ? [220, 53, 69] : [80, 80, 80] } 
      }
    ]);

    autoTable(doc as any, {
      startY: 140,
      head: tableHead,
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [58, 107, 30],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 35, halign: "right" },
        2: { cellWidth: 35, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 30, halign: "right" },
      },
      margin: { left: 10, right: 10 },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text(
      "Mountain Oak Mill • Owner Weekly Trend Report • Automated Delivery",
      105,
      pageHeight - 10,
      { align: "center" }
    );

    const pdfBytes = doc.output("arraybuffer") as unknown as Uint8Array;
    const pdfBase64 = uint8ArrayToBase64(new Uint8Array(pdfBytes));

    // 3. Send Email
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
        subject: `MOM Owner Weekly Trend Report — ${dateStr}`,
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #2d5016;">Mountain Oak Mill</h2>
            <p>Hello,</p>
            <p>Please find the attached <strong>Owner Weekly Trend Report</strong> for the week ending ${formatDate(new Date(rows[0].week_ending))}.</p>
            <p>This report includes a 10-week trend analysis of revenue and inventory value.</p>
            <hr style="border: 1px solid #eee;" />
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Metric</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Current Week</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Trend</th>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">Weekly Revenue</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${formatCurrency(rows[0]["Weekly Revenue"])}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">${rows[1] ? (rows[0]["Weekly Revenue"] >= rows[1]["Weekly Revenue"] ? '📈' : '📉') : '-'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">Closing Inventory</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${formatCurrency(rows[0]["Closing Inv"])}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">${rows[0]["Inv Growth %"] > 0 ? '🔺' : '🔻'} ${rows[0]["Inv Growth %"]}%</td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #888; margin-top: 20px;">
              This is an automated report generated by the Mountain Oak Mill system.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: `Owner_Weekly_Trend_${rows[0].week_ending}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend error: ${error}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Report sent" }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
