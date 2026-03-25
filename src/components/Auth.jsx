import { supabase } from '../services/supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function AuthComponent() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '10px' }}>Welcome!</h1>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>Sign in to your application</p>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']} 
          redirectTo={`${window.location.origin}${window.location.pathname}`} 
        />
      </div>
    </div>
  )
}
