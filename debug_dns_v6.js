
import dns from 'dns';

const hostname = 'db.boyleodbpsgqtjbstcua.supabase.co';

console.log(`Checking IPv6 for ${hostname}...`);

dns.resolve6(hostname, (err, addresses) => {
    if (err) {
        console.error('DNS IPv6 Error:', err);
    } else {
        console.log(`DNS IPv6 Success: ${JSON.stringify(addresses)}`);
    }
});
