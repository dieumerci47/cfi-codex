// Seed idempotent pour une démo présentable.
// - Amitiés mutuelles entre les comptes démo (ada, bob, carl)
// - Répartition d'étoiles sur les cours publics (classement « populaires »)
// Réutilise les comptes existants (pas de service-role) ; sûr à relancer.
// Usage: node scripts/seed-demo.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const PASSWORD = 'codex1234'
const ACCOUNTS = ['ada@cfi.demo', 'bob@cfi.demo', 'carl@cfi.demo']

// Un client authentifié par compte
const clients = {}
for (const email of ACCOUNTS) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) {
    console.log(`⚠️  connexion ${email} échouée (${error.message}) — ignoré`)
    continue
  }
  clients[email] = { client: c, id: data.user.id }
}
const ada = clients['ada@cfi.demo']
const bob = clients['bob@cfi.demo']
const carl = clients['carl@cfi.demo']

// Carte username -> id (lecture publique des profils)
const { data: profs } = await ada.client
  .from('profiles')
  .select('id, username')
const idOf = Object.fromEntries((profs ?? []).map((p) => [p.username, p.id]))

// 1) Amitiés mutuelles : ada <-> bob <-> carl <-> ada
async function follow(actor, targetUsername) {
  if (!actor || !idOf[targetUsername]) return
  await actor.client
    .from('follows')
    .upsert(
      { follower_id: actor.id, following_id: idOf[targetUsername] },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
    )
}
await follow(ada, 'bob')
await follow(bob, 'ada')
await follow(ada, 'carl')
await follow(carl, 'ada')
await follow(bob, 'carl')
await follow(carl, 'bob')
console.log('✅ Amitiés mutuelles ada/bob/carl assurées')

// 2) Étoiles sur les cours publics (classement « populaires »)
const { data: pubs } = await ada.client
  .from('collections')
  .select('id, title, owner_id')
  .eq('visibility', 'public')
const byTitle = Object.fromEntries((pubs ?? []).map((c) => [c.title, c.id]))

async function star(actor, collectionId) {
  if (!actor || !collectionId) return
  await actor.client
    .from('collection_stars')
    .upsert(
      { collection_id: collectionId, user_id: actor.id },
      { onConflict: 'collection_id,user_id', ignoreDuplicates: true },
    )
}
// Réseaux — OSI : populaire (ada, carl, + bob owner)
await star(ada, byTitle['Réseaux — OSI'])
await star(carl, byTitle['Réseaux — OSI'])
await star(bob, byTitle['Réseaux — OSI'])
// LIC2B : (bob, carl)
await star(bob, byTitle['LIC2B 2025-2026'])
await star(carl, byTitle['LIC2B 2025-2026'])
console.log('✅ Étoiles réparties sur les cours publics')

// 3) Récap classement
const { data: ranking } = await ada.client
  .from('collections')
  .select('title, visibility, stars:collection_stars(user_id)')
  .eq('visibility', 'public')
const sorted = (ranking ?? [])
  .map((c) => ({ title: c.title, stars: c.stars?.length ?? 0 }))
  .sort((a, b) => b.stars - a.stars)
console.log('\n⭐ Cours populaires :')
for (const r of sorted) console.log(`   ${r.stars}  ${r.title}`)
console.log('\n🎉 Seed démo OK (idempotent).')
process.exit(0)
