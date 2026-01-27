import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Account({ session }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [website, setWebsite] = useState(null)
  const [avatar_url, setAvatarUrl] = useState(null) // We can ignore this for now

  const userId = session.user.id

  // 1. Function to fetch the user's existing profile from the 'profiles' table
  async function getProfile() {
    try {
      setLoading(true)

      let { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`)
        .eq('id', userId)
        .single() // Expecting only one row

      if (error && status !== 406) { // 406 means no data, which is fine
        throw error
      }

      if (data) {
        setUsername(data.username)
        setWebsite(data.website)
        setAvatarUrl(data.avatar_url)
      }
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  // 2. Function to update or create the user's profile
  async function updateProfile({ username, website, avatar_url }) {
    try {
      setLoading(true)

      const updates = {
        id: userId,
        username,
        website,
        avatar_url,
        updated_at: new Date(),
      }

      let { error } = await supabase.from('profiles').upsert(updates) // upsert inserts OR updates

      if (error) {
        throw error
      }
      alert('Profile updated successfully!')
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  // 3. Runs the profile fetch when the component loads
  useEffect(() => {
    getProfile()
  }, [])

  // Function to sign the user out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error.message)
    }
  }

  return (
    <div className="form-widget">
      {loading ? (
        'Loading profile...'
      ) : (
        <>
          <h2>Your Profile</h2>
          <p>Logged in as: <strong>{session.user.email}</strong></p>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="text" value={session.user.email} disabled />
          </div>

          <div className="input-group">
            <label htmlFor="username">Name / Username</label>
            <input
              id="username"
              type="text"
              value={username || ''}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="website">Website (Optional)</label>
            <input
              id="website"
              type="text"
              value={website || ''}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="input-group">
            <button
              className="button block primary"
              onClick={() => updateProfile({ username, website, avatar_url })}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </>
      )}

      <button className="button block" type="button" onClick={handleSignOut}>
        Log Out
      </button>
    </div>
  )
}