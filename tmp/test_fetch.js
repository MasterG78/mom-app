async function testFetch() {
  try {
    const url = 'https://boyleodbpsgqtjbstcua.supabase.co/functions/v1/generate-production-report';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveWxlb2RicHNncXRqYnN0Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgxNzg4NywiZXhwIjoyMDYwMzkzODg3fQ.HUTqlzogDUiaFV-2Way2t_2QaRzyuPgynWfjG_j5uqw';

    console.log("Calling Edge Function directly via fetch...");
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Fetch failed:", err.message);
    process.exit(1);
  }
}

testFetch();
