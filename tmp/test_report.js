import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function testFunction() {
  try {
    console.log("Testing generate-production-report function manually...");
    const url = 'https://boyleodbpsgqtjbstcua.supabase.co/functions/v1/generate-production-report';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveWxlb2RicHNncXRqYnN0Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgxNzg4NywiZXhwIjoyMDYwMzkzODg3fQ.HUTqlzogDUiaFV-2Way2t_2QaRzyuPgynWfjG_j5uqw';

    await sql`
      SELECT net.http_post(
        url := ${url},
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || ${key},
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    `;

    console.log("HTTP POST request sent to Edge Function via pg_net.");
    console.log("Waiting 5 seconds for it to process...");
    await new Promise(r => setTimeout(r, 5000));

    // Check status in net.http_request_queue or cron logs (if it was a cron job)
    // Actually, net.http_post returns an id, but let's just check the response if possible.
    // Wait, pg_net response is in net.http_responses or similar.
    
    process.exit(0);
  } catch (err) {
    console.error("Manual test failed:", err.message);
    process.exit(1);
  }
}

testFunction();
