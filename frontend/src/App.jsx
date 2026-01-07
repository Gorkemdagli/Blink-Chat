import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Chat from './components/Chat'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Helper function to clear invalid session
    const clearInvalidSession = async () => {
      try {
        await supabase.auth.signOut()
        // Clear all Supabase-related localStorage items
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.includes('supabase') || key.includes('sb-')) {
            localStorage.removeItem(key)
          }
        })
        setSession(null)
      } catch (e) {
        console.error('Error clearing session:', e)
        // Force clear localStorage even if signOut fails
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.includes('supabase') || key.includes('sb-')) {
            localStorage.removeItem(key)
          }
        })
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    // Check if session is inactive for too long (security: clear inactive sessions)
    const isSessionInactive = (session) => {
      if (!session) return true

      // Check last active time (when user was last on the app)
      const lastActiveKey = `last_active_${session.user?.id}`
      const lastActive = localStorage.getItem(lastActiveKey)
      const now = Date.now()

      if (lastActive) {
        const hoursSinceActive = (now - parseInt(lastActive)) / (1000 * 60 * 60)
        // If user hasn't been active for more than 24 hours, clear session for security
        const MAX_INACTIVE_HOURS = 24
        if (hoursSinceActive > MAX_INACTIVE_HOURS) {
          console.log(`Session inactive for ${Math.floor(hoursSinceActive)} hours (max: ${MAX_INACTIVE_HOURS} hours), clearing...`)
          localStorage.removeItem(lastActiveKey)
          return true
        }
      } else {
        // No last active time stored - this is a new session or old session without tracking
        // Store current time as last active
        localStorage.setItem(lastActiveKey, now.toString())
      }

      return false
    }

    // Update last active time
    const updateLastActive = (session) => {
      if (session?.user?.id) {
        const lastActiveKey = `last_active_${session.user.id}`
        localStorage.setItem(lastActiveKey, Date.now().toString())
      }
    }

    // Simple session validation - only check expiration, don't call getUser() to avoid loops
    const isSessionValid = (session) => {
      if (!session) return false

      // Check if session is inactive for too long
      if (isSessionInactive(session)) {
        return false
      }

      // Check if token is expired
      const expiresAt = session.expires_at
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        console.log('Session expired')
        return false
      }

      // Check if user exists in session
      if (!session.user || !session.user.id) {
        console.log('Session missing user data')
        return false
      }

      return true
    }

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Session error:', error)
          const errorMessage = error.message || ''
          // If refresh token is invalid, clear storage and logout
          if (errorMessage.includes('Invalid Refresh Token') ||
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.includes('JWT') ||
            errorMessage.includes('expired')) {
            console.log('Invalid/expired token detected, clearing session...')
            clearInvalidSession()
          } else {
            setSession(null)
            setLoading(false)
          }
        } else if (session && isSessionValid(session)) {
          // Update last active time
          updateLastActive(session)
          setSession(session)
          setLoading(false)
        } else {
          // Session exists but is invalid
          if (session) {
            console.log('Invalid session detected, clearing...')
            clearInvalidSession()
          } else {
            setSession(null)
            setLoading(false)
          }
        }
      })
      .catch((error) => {
        console.error('Error getting session:', error)
        setSession(null)
        setLoading(false)
      })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'has session' : 'no session')

      if (event === 'SIGNED_OUT' || !session) {
        setSession(null)
        setLoading(false)
        // Clear localStorage on sign out
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.includes('supabase') || key.includes('sb-') || key.startsWith('last_active_')) {
            localStorage.removeItem(key)
          }
        })
      } else if (event === 'SIGNED_IN') {
        // New sign in - update last active and set session
        if (isSessionValid(session)) {
          updateLastActive(session)
          setSession(session)
          setLoading(false)
        } else {
          console.log('Invalid session in SIGNED_IN event, clearing...')
          clearInvalidSession()
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed - check if session is still valid and update last active
        if (isSessionValid(session)) {
          updateLastActive(session)
          setSession(session)
          setLoading(false)
        } else {
          console.log('Invalid session in TOKEN_REFRESHED event, clearing...')
          clearInvalidSession()
        }
      } else if (event === 'INITIAL_SESSION') {
        // Initial session load - check if it's valid and not inactive
        if (session && isSessionValid(session)) {
          updateLastActive(session)
          setSession(session)
          setLoading(false)
        } else {
          console.log('Invalid initial session, clearing...')
          clearInvalidSession()
        }
      } else {
        // Other events - just set session if valid
        if (session && isSessionValid(session)) {
          setSession(session)
        } else {
          setSession(null)
        }
        setLoading(false)
      }
    })

    // Update last active time periodically while user is active (every 5 minutes)
    let activeInterval
    if (session) {
      activeInterval = setInterval(() => {
        updateLastActive(session)
      }, 5 * 60 * 1000) // 5 minutes
    }

    // Clean up on unmount
    return () => {
      subscription.unsubscribe()
      if (activeInterval) {
        clearInterval(activeInterval)
      }
    }
  }, [])

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('chat-theme') === 'dark'
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('chat-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('chat-theme', 'light')
    }
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode(!darkMode)

  // Show loading screen while checking session
  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {!session ? (
        <Auth onAuth={setSession} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      ) : (
        <Chat session={session} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      )}
    </div>
  )
}

export default App
