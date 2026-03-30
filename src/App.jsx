import { useState, useEffect } from 'react'
import { supabase } from './services/supabaseClient'
import Auth from './components/Auth'
import InventoryEntry from './components/InventoryEntry'
import InventoryList from './components/InventoryList'
import ProductManager from './components/ProductManager'
import InventoryReport from './components/InventoryReport'
import ProductionReport from './components/Production'
import Export from './components/Export'
import PrintTagModal from './components/PrintTagModal'
import InventoryManager from './components/InventoryManager'

const mockData = {
  tag: '999999',
  product_name: '2x4x8 PREMIUM PINE S4S',
  boardfeet: 128,
  species_name: 'SYP PREMIUM',
  line: 'TEST-A',
  produced: new Date().toISOString()
};

export default function App() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null) // Database role
  const [effectiveRole, setEffectiveRole] = useState(null) // Active role (can be changed by admin)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true) // Initial loading state

  // NAVIGATION control ('entry', 'products', 'reports', or 'manager')
  const [view, setView] = useState('entry')

  const fetchUserRole = async (userId, userEmail) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .single();
      
      let initialRole = 'unauthorized';
      if (data?.role) {
        initialRole = data.role;
      } else if (userEmail && userEmail.endsWith('@mountainoakmill.com')) {
        initialRole = 'mill'; // Default company users to mill
      }

      setUserRole(initialRole);
      setEffectiveRole(initialRole); // Initially same as database role
    } catch (err) {
      console.error('Unexpected error fetching role:', err);
      setUserRole('unauthorized');
      setEffectiveRole('unauthorized');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for OAuth errors in the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
    
    if (errorDescription) {
      alert(`Login Error: ${decodeURIComponent(errorDescription).replace(/\+/g, ' ')}`);
      // Clean up the URL to prevent showing the error again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.id) {
        fetchUserRole(session.user.id, session.user.email)
      } else {
        setLoading(false);
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.id) {
        fetchUserRole(session.user.id, session.user.email)
      } else {
        setUserRole(null)
        setEffectiveRole(null)
        setView('entry')
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Base permission checks on effectiveRole
  const canManage = effectiveRole === 'admin' || effectiveRole === 'office';
  const isTest = effectiveRole === 'test';

  const triggerListRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1)
  }

  // --- Styles ---
  const navStyle = {
    display: 'flex',
    gap: '10px',
    marginBottom: '30px',
    borderBottom: '2px solid #eee',
    paddingBottom: '10px'
  };

  const navButtonStyle = (active) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    backgroundColor: active ? '#007bff' : '#f8f9fa',
    color: active ? 'white' : '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  });

  const globalStyles = `
    @media print {
      .no-print { display: none !important; }
    }
    .unauthorized-box {
      background-color: #f8dbdb;
      color: #900;
      padding: 30px;
      border-radius: 8px;
      border: 1px solid #dca7a7;
      text-align: center;
      margin-top: 50px;
    }
  `;

  // Determine if the user has NO recognized role yet (or hasn't loaded)
  const isUnauthorized = session && !loading && effectiveRole === 'unauthorized';

  return (
    <div className="container">
      <style>{globalStyles}</style>
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>Loading application...</div>
      ) : !session ? (
        <Auth />
      ) : isUnauthorized ? (
        <div className="unauthorized-box">
          <h2>Access Denied</h2>
          <p>You are not currently authorized to access this application.</p>
          <p>You must sign in with a company email (@mountainoakmill.com) or contact an administrator to provision your account.</p>
          <button 
            style={{ marginTop: '20px', ...navButtonStyle(false), backgroundColor: '#dc3545', color: 'white' }} 
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <>
          {/* NAVIGATION MENU */}
          <nav style={navStyle} className="no-print">
            <button
              style={navButtonStyle(view === 'entry')}
              onClick={() => setView('entry')}
            >
              Inventory Entry
            </button>
            {canManage && (
              <button
                style={navButtonStyle(view === 'manager')}
                onClick={() => setView('manager')}
              >
                Tag Lookup
              </button>
            )}
            {canManage && (
              <button
                style={navButtonStyle(view === 'products')}
                onClick={() => setView('products')}
              >
                Manage Products
              </button>
            )}
            {canManage && (
              <button
                style={navButtonStyle(view === 'reports')}
                onClick={() => setView('reports')}
              >
                Reports
              </button>
            )}
            <button
              style={navButtonStyle(view === 'production')}
              onClick={() => setView('production')}
            >
              Production
            </button>
            {canManage && (
              <button
                style={navButtonStyle(view === 'export')}
                onClick={() => setView('export')}
              >
                Export
              </button>
            )}

            <button
              onClick={() => supabase.auth.signOut()}
              style={{ ...navButtonStyle(false), marginLeft: 'auto', backgroundColor: '#dc3545', color: 'white' }}
            >
              Logout
            </button>
          </nav>

          {/* ADMIN ROLE ADAPTER */}
          {userRole === 'admin' && (
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', border: '1px solid #b3d7ff', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontWeight: 'bold', color: '#0056b3' }}>Admin Simulation Mode:</span>
              <select 
                value={effectiveRole} 
                onChange={(e) => setEffectiveRole(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #007bff' }}
              >
                <option value="admin">Admin (All Access)</option>
                <option value="office">Office (Manage/Report)</option>
                <option value="mill">Mill (Entry/Production)</option>
                <option value="test">Test Role (Mock Labels)</option>
              </select>
              <span style={{ fontSize: '12px', color: '#666' }}>Switch roles to test different permissions.</span>
            </div>
          )}

          {/* CONDITIONAL RENDERING BASED ON VIEW AND ROLE */}
          {effectiveRole !== null && view === 'entry' && (
            <>
              <InventoryEntry session={session} onBundleCreated={triggerListRefresh} isTest={isTest} />
              <InventoryList key={refreshKey} />
            </>
          )}

          {canManage && view === 'manager' && (
            <InventoryManager isTest={isTest} session={session} />
          )}

          {canManage && view === 'products' && (
            <ProductManager />
          )}

          {canManage && view === 'reports' && (
            <InventoryReport />
          )}

          {effectiveRole !== null && view === 'production' && (
            <ProductionReport />
          )}

          {canManage && view === 'export' && (
            <Export />
          )}
        </>
      )}
    </div>
  )
}