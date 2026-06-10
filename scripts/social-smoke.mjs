// Smoke test de la couche sociale (post, feed, like, commentaire, follow).
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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

let failures = 0
const check = (ok, msg, extra) => {
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`)
}

const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'ada@cfi.demo',
  password: 'codex1234',
})
const me = auth.user.id

// bob
const { data: bob } = await supabase
  .from('profiles')
  .select('id')
  .eq('username', 'bob')
  .single()

// 1) Créer un post
const { data: post, error: pErr } = await supabase
  .from('posts')
  .insert({ author_id: me, body: 'Premier post de test ✦' })
  .select()
  .single()
check(!pErr && !!post, 'Création post', pErr?.message)

// 2) Lire le feed (avec compteurs)
const { data: feed, error: fErr } = await supabase
  .from('posts')
  .select('*, author:profiles!posts_author_id_fkey(username), likes(user_id), comments(count)')
  .order('created_at', { ascending: false })
check(!fErr && feed.some((p) => p.id === post.id), 'Lecture feed', `${feed?.length} post(s)`)

// 3) Like
const { error: lErr } = await supabase
  .from('likes')
  .insert({ post_id: post.id, user_id: me })
check(!lErr, 'Like post', lErr?.message)

// 4) Comment
const { error: cErr } = await supabase
  .from('comments')
  .insert({ post_id: post.id, author_id: me, body: 'Bien joué !' })
check(!cErr, 'Commentaire', cErr?.message)

// 5) Follow bob
const { error: foErr } = await supabase
  .from('follows')
  .insert({ follower_id: me, following_id: bob.id })
check(!foErr, 'Suivre bob', foErr?.message)

// 6) Vérifier l'état du follow
const { data: fs } = await supabase
  .from('follows')
  .select('*')
  .eq('follower_id', me)
  .eq('following_id', bob.id)
  .maybeSingle()
check(!!fs, 'État follow persistant')

// 7) RLS négatif : liker au nom d'un autre
const { error: badLike } = await supabase
  .from('likes')
  .insert({ post_id: post.id, user_id: bob.id })
check(!!badLike, 'RLS bloque like pour autrui', badLike ? 'refusé ✓' : 'NON BLOQUÉ !')

// Nettoyage
await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', bob.id)
await supabase.from('posts').delete().eq('id', post.id)

console.log(`\n${failures === 0 ? '🎉 Couche sociale OK' : `⚠️  ${failures} échec(s)`}`)
process.exit(failures === 0 ? 0 : 1)
