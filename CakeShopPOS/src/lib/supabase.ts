import { createClient, SupabaseClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://lekvwqdqarnvqsksjtti.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3Z3cWRxYXJudnFza3NqdHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjc1NjcsImV4cCI6MjEwNDY0MzU2N30.qBSgDCiemOfQFwp3KsskqN7T30-d2pyofRh-X8wd_1E'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

// Create a singleton Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

export const isSupabaseConfigured = (): boolean => {
  return (
    !!import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    !!import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
  )
}
