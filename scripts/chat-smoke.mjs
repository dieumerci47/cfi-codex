// Smoke test du chat : DM (RPC), messages, RLS, realtime.
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
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const ada = mk(),
  bob = mk()

let fail = 0
const ck = (ok, m, e) => {
  if (!ok) fail++
  console.log((ok ? 'OK ' : 'KO ') + m + (e ? ' — ' + (e.message || JSON.stringify(e)) : ''))
}

const A = await ada.auth.signInWithPassword({ email: 'ada@cfi.demo', password: 'codex1234' })
const B = await bob.auth.signInWithPassword({ email: 'bob@cfi.demo', password: 'codex1234' })
const bobId = B.data.user.id

// 1) ada ouvre un DM avec bob
let { data: cid, error: e1 } = await ada.rpc('get_or_create_dm', { other: bobId })
ck(!e1 && !!cid, 'get_or_create_dm', e1)

// 2) idempotent : 2e appel -> même conversation
const { data: cid2 } = await ada.rpc('get_or_create_dm', { other: bobId })
ck(cid === cid2, 'DM idempotent (pas de doublon)')

// 3) realtime : bob s'abonne aux messages de la conv
await bob.realtime.setAuth(B.data.session.access_token)
let received = null
const channel = bob
  .channel('test-conv-' + cid)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` },
    (payload) => {
      received = payload.new
    },
  )
await new Promise((res) => channel.subscribe((status) => status === 'SUBSCRIBED' && res()))

// 4) ada envoie un message
const { error: e2 } = await ada.from('messages').insert({ conversation_id: cid, sender_id: A.data.user.id, body: 'Salut Bob !' })
ck(!e2, 'Ada envoie un message', e2)

// 5) bob voit le message (lecture RLS)
const { data: msgs, error: e3 } = await bob.from('messages').select('*').eq('conversation_id', cid)
ck(!e3 && msgs.length === 1 && msgs[0].body === 'Salut Bob !', 'Bob lit le message (RLS membre)', e3)

// 6) realtime reçu ?
await new Promise((r) => setTimeout(r, 1500))
ck(received?.body === 'Salut Bob !', 'Realtime : message reçu en live', received ? null : { message: 'aucun event' })

// 7) la conversation remonte chez bob
const { data: convs } = await bob.from('conversations').select('id').eq('id', cid)
ck(convs?.length === 1, 'Bob voit la conversation')

// 8) RLS négatif : un message avec sender usurpé
const { error: e4 } = await bob.from('messages').insert({ conversation_id: cid, sender_id: A.data.user.id, body: 'usurpation' })
ck(!!e4, 'RLS bloque sender usurpé', e4 ? { message: 'refusé' } : null)

// cleanup
await ada.removeChannel(channel)
await ada.from('conversations').delete().eq('id', cid)

console.log(fail === 0 ? '\n🎉 chat OK' : `\n⚠️  ${fail} échec(s)`)
process.exit(fail ? 1 : 0)
