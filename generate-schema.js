import postgres from 'postgres';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// --- CONFIGURATION ---
// We are using the encoded password (%23) and standard protocol
// --- CONFIGURATION ---
// We are using the encoded password (%23) and standard protocol
const originalConnectionString = 'postgresql://postgres:mQ9XsFnExTitu%23%23@db.boyleodbpsgqtjbstcua.supabase.co:5432/postgres';

import dns from 'dns/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = join(__dirname, 'DB_SCHEMA.md');

async function resolveHost(connectionStr) {
    try {
        const url = new URL(connectionStr);
        // Try to resolve IPv6 addresses
        const addresses = await dns.resolve6(url.hostname);
        if (addresses.length > 0) {
            console.log(`Resolved ${url.hostname} to IPv6: ${addresses[0]}`);
            url.hostname = `[${addresses[0]}]`;
            return {
                url: url.toString(),
                ssl: { rejectUnauthorized: false } // Required when using IP match
            };
        }
    } catch (e) {
        console.warn('IPv6 resolution failed, falling back to original URL:', e.message);
    }
    return { url: connectionStr, ssl: undefined };
}

async function generateMarkdownSchema() {
    const { url, ssl } = await resolveHost(originalConnectionString);

    // Increased timeout and added connect_timeout to handle shaky DNS
    const sql = postgres(url, {
        connect_timeout: 10,
        idle_timeout: 20,
        max_lifecycle: Infinity,
        ssl: ssl
    });

    try {
        console.log('Attempting to connect to Supabase...');

        const rows = await sql`
            SELECT 
                table_name, 
                column_name, 
                udt_name as data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name NOT IN ('pg_stat_statements')
            ORDER BY table_name, ordinal_position
        `;

        if (rows.length === 0) {
            console.warn('⚠️ Connection successful, but no tables found in "public".');
            return;
        }

        let markdown = '# Database Schema Snapshot\n';
        markdown += `*Generated on: ${new Date().toLocaleString()}*\n\n`;

        const tables = {};
        for (const row of rows) {
            if (!tables[row.table_name]) tables[row.table_name] = [];
            tables[row.table_name].push(row);
        }

        for (const tableName in tables) {
            markdown += `## Table: ${tableName}\n`;
            markdown += `| Column | Type | Nullable | Default |\n`;
            markdown += `| :--- | :--- | :--- | :--- |\n`;
            for (const col of tables[tableName]) {
                const nullable = col.is_nullable === 'YES' ? 'YES' : 'NO';
                const defaultValue = col.column_default ? `\`${col.column_default}\`` : '-';
                markdown += `| **${col.column_name}** | \`${col.data_type}\` | ${nullable} | ${defaultValue} |\n`;
            }
            markdown += '\n';
        }

        fs.writeFileSync(outputPath, markdown);
        console.log('--------------------------------------------------');
        console.log('✅ SUCCESS: DB_SCHEMA.md updated!');
        console.log('--------------------------------------------------');

    } catch (err) {
        console.error('--------------------------------------------------');
        console.error('❌ Connection Failed:');
        console.error(err.message);
        console.log('\nTIP: If you see "ENOTFOUND", check if your project');
        console.log('is "Paused" in the Supabase Dashboard.');
        console.log('--------------------------------------------------');
        process.exit(1);
    } finally {
        await sql.end();
    }
}

generateMarkdownSchema();