// Smoke test du data layer Codex contre Supabase (RLS, inserts, storage).
// Usage: node scripts/smoke-test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Charge .env.local manuellement
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
)

const log = (ok, msg, extra) =>
  console.log(`${ok ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`)

let failures = 0
const check = (ok, msg, extra) => {
  if (!ok) failures++
  log(ok, msg, extra)
}

// 1) Login
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'ada@cfi.demo',
  password: 'codex1234',
})
check(!authErr && !!auth.session, 'Connexion ada@cfi.demo', authErr?.message)

// 2) Onboarding : set username
const { error: upErr } = await supabase
  .from('profiles')
  .update({ username: 'ada', full_name: 'Ada Lovelace', promo: 'L2 Info' })
  .eq('id', auth.user.id)
check(!upErr, 'Onboarding (update profil)', upErr?.message)

// 3) Lire matières
const { data: subjects, error: subjErr } = await supabase
  .from('subjects')
  .select('*')
check(!subjErr && subjects.length > 0, 'Lecture des matières', `${subjects?.length} matières`)

// 4) Créer une collection
const { data: col, error: colErr } = await supabase
  .from('collections')
  .insert({ owner_id: auth.user.id, title: 'Algo (test)', visibility: 'public' })
  .select()
  .single()
check(!colErr && !!col, 'Création collection', colErr?.message)

// 5) Créer une note (resource)
const { data: note, error: noteErr } = await supabase
  .from('resources')
  .insert({
    collection_id: col.id,
    kind: 'note',
    name: 'intro.md',
    note_content: '# Intro\nTest **markdown**.',
  })
  .select()
  .single()
check(!noteErr && !!note, 'Création note', noteErr?.message)

// 6) Relire les ressources
const { data: resources, error: resErr } = await supabase
  .from('resources')
  .select('*')
  .eq('collection_id', col.id)
check(!resErr && resources.length === 1, 'Relecture ressources', `${resources?.length} ressource(s)`)

// 7) RLS négatif : tenter de créer une collection au nom d'un autre owner
const { error: rlsErr } = await supabase
  .from('collections')
  .insert({ owner_id: '00000000-0000-0000-0000-000000000001', title: 'pirate' })
check(!!rlsErr, 'RLS bloque insert pour autrui', rlsErr ? 'refusé ✓' : 'NON BLOQUÉ !')

// Nettoyage
await supabase.from('collections').delete().eq('id', col.id)

console.log(`\n${failures === 0 ? '🎉 Tous les tests passent' : `⚠️  ${failures} échec(s)`}`)
process.exit(failures === 0 ? 0 : 1)
