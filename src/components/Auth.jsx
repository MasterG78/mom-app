import { supabase } from '../services/supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function AuthComponent() {
  return (
    <div className="row flex flex-center">
      <div className="col-6 form-widget">
        <h1 className="header">Welcome!</h1>
        <p className="description">Sign in to your application</p>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']} 
          redirectTo={window.location.href} 
        />
      </div>
    </div>
  )
}
