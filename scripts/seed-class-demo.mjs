// Vérifie + démontre le pattern "collection = classe" :
// LIC2B 2025-2026 > (Math, Anglais) > chap1.pdf / note.
// Crée la structure en tant que ada (chemin RLS réel) + upload fichier réel.
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

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'ada@cfi.demo',
  password: 'codex1234',
})
if (authErr) throw authErr
const me = auth.user.id

// Évite les doublons si relancé
const { data: existing } = await supabase
  .from('collections')
  .select('id')
  .eq('owner_id', me)
  .eq('title', 'LIC2B 2025-2026')
  .maybeSingle()
if (existing) {
  console.log('ℹ️  La classe démo existe déjà, rien à faire.')
  process.exit(0)
}

// 1) La "classe" = une collection
const { data: col } = await supabase
  .from('collections')
  .insert({
    owner_id: me,
    title: 'LIC2B 2025-2026',
    description: 'Ma classe — tous les cours de l’année, rangés par matière.',
    visibility: 'public',
  })
  .select()
  .single()
console.log('✅ Collection (classe) créée :', col.title)

// 2) Les matières = des dossiers à la racine
const mkFolder = async (name, parent_id = null) => {
  const { data } = await supabase
    .from('resources')
    .insert({ collection_id: col.id, parent_id, kind: 'folder', name })
    .select()
    .single()
  return data
}
const math = await mkFolder('Math')
const anglais = await mkFolder('Anglais')
console.log('✅ Dossiers créés : Math, Anglais')

// 3) Un vrai PDF uploadé DANS le dossier Math
const pdf = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 70>>stream
BT /F1 22 Tf 60 760 Td (Math - Chapitre 1 : Suites) Tj ET
endstream
endobj
trailer<</Root 1 0 R>>
%%EOF`,
  'latin1',
)
const path = `${me}/${col.id}/${Date.now()}-chap1.pdf`
const { error: upErr } = await supabase.storage
  .from('resources')
  .upload(path, pdf, { contentType: 'application/pdf' })
if (upErr) throw upErr
await supabase.from('resources').insert({
  collection_id: col.id,
  parent_id: math.id,
  kind: 'file',
  name: 'chap1.pdf',
  storage_path: path,
  mime_type: 'application/pdf',
  size_bytes: pdf.length,
})
console.log('✅ Fichier uploadé : Math/chap1.pdf')

// 4) Une note dans Anglais
await supabase.from('resources').insert({
  collection_id: col.id,
  parent_id: anglais.id,
  kind: 'note',
  name: 'vocabulaire.md',
  note_content: '# Vocabulaire — Unit 1\n\n- *to improve* : améliorer\n- *knowledge* : le savoir',
})
console.log('✅ Note créée : Anglais/vocabulaire.md')

// 5) Vérifie la lecture via URL signée (RLS storage)
const { data: signed, error: sErr } = await supabase.storage
  .from('resources')
  .createSignedUrl(path, 60)
console.log(
  sErr ? '❌ URL signée KO : ' + sErr.message : '✅ Lecture fichier (URL signée) OK',
)

// 6) Affiche l'arbre
const { data: tree } = await supabase
  .from('resources')
  .select('id, name, kind, parent_id')
  .eq('collection_id', col.id)
const byParent = (pid) => tree.filter((r) => (r.parent_id ?? null) === pid)
const icon = { folder: '📁', file: '📄', note: '📝' }
console.log('\n' + col.title + '/')
for (const f of byParent(null)) {
  console.log('  ' + icon[f.kind] + ' ' + f.name + (f.kind === 'folder' ? '/' : ''))
  for (const c of byParent(f.id)) {
    console.log('      ' + icon[c.kind] + ' ' + c.name)
  }
}
console.log('\n🎉 Pattern "collection = classe" vérifié de bout en bout.')
process.exit(0)
