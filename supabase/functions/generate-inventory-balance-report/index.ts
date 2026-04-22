import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import autoTable from "https://esm.sh/jspdf-autotable@3.8.4";

// ── Helpers ────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "0.00";
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

interface BalanceReportRow {
  week_ending: string;
  "Opening Inv": number;
  "Production": number;
  "Sold (Inv Val)": number;
  "Issued": number;
  "Voided": number;
  "Adjustments": number;
  "Closing Inv": number;
  "Actual Revenue": number;
  "Inventory Value of Sales": number;
  "Sales Variance": number;
}

// ── Main Handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  console.log("Inventory Balance Report function invoked:", req.method);
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
      throw new Error("RESEND_API_KEY not configured.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch last 10 weeks
    console.log("Fetching balance report data...");
    const { data: reportData, error: reportError } = await supabase
      .from("owner_weekly_inventory_balance_report")
      .select("*")
      .order("week_ending", { ascending: false })
      .limit(10);

    if (reportError) {
       console.error("DB Error:", reportError);
       throw reportError;
    }
    
    if (!reportData || reportData.length === 0) {
      console.warn("No data found in owner_weekly_inventory_balance_report");
      return new Response(JSON.stringify({ success: false, message: "No data found" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const rows = reportData as BalanceReportRow[];
    const now = todayET();
    const dateStr = formatDate(now);

    // ── Generate PDF ─────────────────────────────────────────────────────
    console.log("Building PDF...");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); // Landscape for more columns

    // Header
    doc.setFillColor(45, 80, 22); // Dark green
    doc.rect(0, 0, 297, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Mountain Oak Mill", 148.5, 14, { align: "center" });
    doc.setFontSize(11);
    doc.text("Inventory Balance Sheet & Variance Report", 148.5, 22, { align: "center" });

    // Subheader
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.text(`Generated on: ${dateStr}`, 148.5, 38, { align: "center" });

    // Balancing Table
    doc.setTextColor(45, 80, 22);
    doc.setFontSize(12);
    doc.text("Inventory Balancing (at Inventory Value)", 15, 48);

    const balanceHead = [["Week Ending", "Opening Inv", "Production (+)", "Sold (-)", "Issued (-)", "Voided (-)", "Adjustments", "Closing Inv (=)"]];
    const balanceBody = rows.map(r => [
      formatDate(new Date(r.week_ending)),
      `$${formatCurrency(r["Opening Inv"])}`,
      `$${formatCurrency(r["Production"])}`,
      `$${formatCurrency(r["Sold (Inv Val)"])}`,
      `$${formatCurrency(r["Issued"])}`,
      `$${formatCurrency(r["Voided"])}`,
      { 
        content: `$${formatCurrency(r["Adjustments"])}`, 
        styles: { textColor: Math.abs(r["Adjustments"]) > 50 ? [220, 53, 69] : [80, 80, 80] } 
      },
      `$${formatCurrency(r["Closing Inv"])}`
    ]);

    autoTable(doc as any, {
      startY: 52,
      head: balanceHead,
      body: balanceBody,
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
        4: { cellWidth: 35, halign: "right" },
        5: { cellWidth: 35, halign: "right" },
        6: { cellWidth: 30, halign: "right" },
        7: { cellWidth: 35, halign: "right" },
      },
      margin: { left: 10, right: 10 },
    });

    // Variance Table (Sanity Check)
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setTextColor(45, 80, 22);
    doc.setFontSize(12);
    doc.text("Sales Sanity Check (Revenue vs. Inventory Value)", 15, finalY);

    const varianceHead = [["Week Ending", "Actual Revenue", "Inventory Value of Sales", "Sales Variance (Markup)"]];
    const varianceBody = rows.map(r => [
      formatDate(new Date(r.week_ending)),
      `$${formatCurrency(r["Actual Revenue"])}`,
      `$${formatCurrency(r["Inventory Value of Sales"])}`,
      `$${formatCurrency(r["Sales Variance"])}`
    ]);

    autoTable(doc as any, {
      startY: finalY + 4,
      head: varianceHead,
      body: varianceBody,
      theme: "striped",
      headStyles: {
        fillColor: [80, 80, 80],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 60, halign: "right" },
        2: { cellWidth: 60, halign: "right" },
        3: { cellWidth: 60, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 15 },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text(
      "Mountain Oak Mill • Inventory Balance Report • This report must balance naturally (Opening + Production - Outflows + Adjustments = Closing)",
      148.5,
      pageHeight - 10,
      { align: "center" }
    );

    const pdfBytes = doc.output("arraybuffer") as unknown as Uint8Array;
    const pdfBase64 = uint8ArrayToBase64(new Uint8Array(pdfBytes));

    // ── Send Email ───────────────────────────────────────────────────────
    console.log("Sending email via Resend...");
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
        subject: `MOM Inventory Balance Report — ${dateStr}`,
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #2d5016;">Mountain Oak Mill</h2>
            <p>Hello,</p>
            <p>Please find the attached <strong>Inventory Balance Report</strong> for the week ending ${formatDate(new Date(rows[0].week_ending))}.</p>
            <p>This report accounts for all inventory movements at their inventory value to ensure system integrity. It also includes a sales variance check to compare actual revenue against the inventory value of goods sold.</p>
            <hr style="border: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">
              This is an automated report generated by the Mountain Oak Mill system.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: `Inventory_Balance_${rows[0].week_ending}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend error: ${error}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Balance report sent" }), {
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
