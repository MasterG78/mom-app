
import { exec } from 'child_process';

const cmd = `echo "SELECT tgname FROM pg_trigger WHERE tgrelid = 'inventory'::regclass;" | supabase db execute`;

exec(cmd, { cwd: 'c:/projects/supabase/mom/mom-app' }, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
});
