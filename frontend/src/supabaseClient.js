import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'chat-app',
    },
    fetch: (url, options = {}) => {
      // Connection keep-alive için timeout artır
      return fetch(url, {
        ...options,
        keepalive: true,
      })
    },
  },
  db: {
    schema: 'public',
  },
})
