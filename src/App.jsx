import { useState, useEffect } from 'react'
import { supabase } from './services/supabaseClient'
import Auth from './components/Auth'
import InventoryEntry from './components/InventoryEntry'
import InventoryList from './components/InventoryList'
import ProductManager from './components/ProductManager'
import InventoryReport from './components/InventoryReport'
import ProductionReport from './components/Production'
import Export from './components/Export'

export default function App() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // NAVIGATION control ('entry', 'products', or 'reports')
  const [view, setView] = useState('entry')

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching role:', error);
      }
      
      setUserRole(data?.role || 'unauthorized'); // Default to locked out if no row exists
    } catch (err) {
      console.error('Unexpected error fetching role:', err);
      setUserRole('unauthorized');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.id) fetchUserRole(session.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.id) {
        fetchUserRole(session.user.id)
      } else {
        setUserRole(null)
        setView('entry') // reset view on logout
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const canManage = userRole === 'admin' || userRole === 'office';

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
  // If userRole is null, we are fetching it. If userRole === 'unauthorized', they are blocked.
  const isUnauthorized = session && userRole === 'unauthorized';

  return (
    <div className="container" style={{ padding: '50px 0 100px 0' }}>
      <style>{globalStyles}</style>
      {!session ? (
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

          {/* CONDITIONAL RENDERING BASED ON VIEW AND ROLE */}
          {userRole !== null && view === 'entry' && (
            <>
              <InventoryEntry session={session} onBundleCreated={triggerListRefresh} />
              <InventoryList key={refreshKey} />
            </>
          )}

          {canManage && view === 'products' && (
            <ProductManager />
          )}

          {canManage && view === 'reports' && (
            <InventoryReport />
          )}

          {userRole !== null && view === 'production' && (
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