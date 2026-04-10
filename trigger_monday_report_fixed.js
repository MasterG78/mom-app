
const url = 'https://boyleodbpsgqtjbstcua.supabase.co/functions/v1/generate-production-report';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveWxlb2RicHNncXRqYnN0Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgxNzg4NywiZXhwIjoyMDYwMzkzODg3fQ.HUTqlzogDUiaFV-2Way2t_2QaRzyuPgynWfjG_j5uqw';

async function trigger() {
  console.log('--- Triggering Monday (2026-04-06) Production Report (FIXED) ---');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target_date: '2026-04-06'
      })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

trigger();
