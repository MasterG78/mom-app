
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Path to .env.local
env_path = '.env.local'
load_dotenv(env_path)

url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print(f"Error: Missing environment variables. url={url}, key_exists={bool(key)}")
    exit(1)

supabase: Client = create_client(url, key)

def test_access():
    print(f"Testing access to {url} with service_role key...")
    try:
        # Try to access a protected schema or table
        # decrypted_secrets is in the vault schema
        response = supabase.table("decrypted_secrets").select("*").limit(1).execute()
        print(f"Successfully accessed vault! Found {len(response.data)} secrets.")
    except Exception as e:
        print(f"Access check failed or decrypted_secrets view does not exist.")
        print(f"Error: {e}")
        
    try:
        # Simple health check
        response = supabase.table("inventory").select("count", count="exact").limit(1).execute()
        print(f"API Health Check: inventory count = {response.count}")
    except Exception as e:
        print(f"API Health Check failed: {e}")

if __name__ == "__main__":
    test_access()
