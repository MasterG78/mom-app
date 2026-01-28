
import dns from 'dns';

const hostname = 'db.boyleodbpsgqtjbstcua.supabase.co';

console.log(`Looking up ${hostname}...`);

dns.lookup(hostname, (err, address, family) => {
    if (err) {
        console.error('DNS Lookup Error:', err);
    } else {
        console.log(`DNS Lookup Success: Address: ${address}, Family: IPv${family}`);
    }
});

// Also try resolving all records
dns.resolve(hostname, (err, addresses) => {
    if (err) {
        console.error('DNS Resolve Error:', err);
    } else {
        console.log(`DNS Resolve Success: ${JSON.stringify(addresses)}`);
    }
});
