import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

let instance: SupabaseClient | null = null

export function makeClient(): SupabaseClient {
  if (!instance) {
    instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return instance
}

export const supabase = makeClient()
