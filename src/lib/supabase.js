import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // Message explicite en dev : évite des erreurs obscures plus loin.
  // On ne fait pas planter l'app (la landing reste consultable sans backend).
  console.error(
    '[Codex] Variables Supabase manquantes. Crée un fichier .env.local à partir de .env.example ' +
      'avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
  )
}

// Fallback inoffensif pour éviter le crash de createClient à l'import.
// Toute requête réelle échouera tant que .env.local n'est pas configuré.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
