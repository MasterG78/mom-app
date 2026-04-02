
import postgres from 'postgres';
import fs from 'fs';

const sql = postgres("postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres");

async function applyMissingFunction() {
  console.log('--- Applying Missing Migration: upsert_invoices_bulk.sql ---');
  try {
    const migration = fs.readFileSync('supabase/migrations/upsert_invoices_bulk.sql', 'utf8');
    await sql.unsafe(migration);
    console.log('✅ Successfully applied upsert_invoices_bulk.sql to production.');
  } catch (error) {
    console.error('Error applying migration:', error.message);
  } finally {
    await sql.end();
  }
}

applyMissingFunction();
