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
  const [refreshKey, setRefreshKey] = useState(0)

  // NAVIGATION control ('entry', 'products', or 'reports')
  const [view, setView] = useState('entry')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

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
  `;

  return (
    <div className="container" style={{ padding: '50px 0 100px 0' }}>
      <style>{globalStyles}</style>
      {!session ? (
        <Auth />
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
            <button
              style={navButtonStyle(view === 'products')}
              onClick={() => setView('products')}
            >
              Manage Products
            </button>
            <button
              style={navButtonStyle(view === 'reports')}
              onClick={() => setView('reports')}
            >
              Reports
            </button>
            <button
              style={navButtonStyle(view === 'production')}
              onClick={() => setView('production')}
            >
              Production
            </button>
            <button
              style={navButtonStyle(view === 'export')}
              onClick={() => setView('export')}
            >
              Export
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              style={{ ...navButtonStyle(false), marginLeft: 'auto', backgroundColor: '#dc3545', color: 'white' }}
            >
              Logout
            </button>
          </nav>

          {/* CONDITIONAL RENDERING BASED ON VIEW */}
          {view === 'entry' && (
            <>
              <InventoryEntry session={session} onBundleCreated={triggerListRefresh} />
              <InventoryList key={refreshKey} />
            </>
          )}

          {view === 'products' && (
            <ProductManager />
          )}

          {view === 'reports' && (
            <InventoryReport />
          )}

          {view === 'production' && (
            <ProductionReport />
          )}

          {view === 'export' && (
            <Export />
          )}
        </>
      )}
    </div>
  )
}