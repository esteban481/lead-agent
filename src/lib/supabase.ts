import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client avec service role key — uniquement côté serveur (API routes, cron)
// Ne jamais exposer côté client
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
