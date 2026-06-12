import { supabase } from '@/lib/supabase'

const RESOURCES_BUCKET = 'resources'

/** Déclenche le téléchargement d'un Blob côté navigateur. */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Récupère le Blob d'un fichier du bucket privé `resources`. */
async function fileBlob(storagePath) {
  const { data, error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .download(storagePath)
  if (error) throw error
  return data
}

/** Nettoie un nom pour un chemin de zip (pas de slash ni de caractères douteux). */
function safeName(name) {
  return (name || 'sans-nom').replace(/[\\/:*?"<>|]+/g, '_').trim()
}

/** Télécharge un fichier seul. */
export async function downloadFile(resource) {
  const blob = await fileBlob(resource.storage_path)
  saveBlob(blob, safeName(resource.name))
}

/** Télécharge une note markdown (.md). */
export function downloadNote(resource) {
  const base = safeName(resource.name)
  const name = base.toLowerCase().endsWith('.md') ? base : `${base}.md`
  saveBlob(
    new Blob([resource.note_content ?? ''], { type: 'text/markdown' }),
    name,
  )
}

/**
 * Télécharge un sous-arbre (dossier ou collection entière) en .zip.
 * `resources` = toutes les ressources de la collection ; `rootId` = id du dossier
 * racine à zipper (null = toute la collection). Reconstruit l'arborescence.
 */
export async function downloadTreeZip(rootName, resources, rootId = null) {
  // Chargé à la demande : JSZip reste hors du bundle de la page.
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const childrenOf = (pid) =>
    resources.filter((r) => (r.parent_id ?? null) === pid)

  async function walk(folder, parentId) {
    for (const r of childrenOf(parentId)) {
      if (r.kind === 'folder') {
        await walk(folder.folder(safeName(r.name)), r.id)
      } else if (r.kind === 'note') {
        const base = safeName(r.name)
        const nm = base.toLowerCase().endsWith('.md') ? base : `${base}.md`
        folder.file(nm, r.note_content ?? '')
      } else if (r.kind === 'file' && r.storage_path) {
        folder.file(safeName(r.name), await fileBlob(r.storage_path))
      }
    }
  }

  await walk(zip, rootId)
  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, `${safeName(rootName)}.zip`)
}

/** Télécharge la bonne chose selon le type de ressource. */
export async function downloadResource(resource, resources) {
  if (resource.kind === 'note') return downloadNote(resource)
  if (resource.kind === 'folder')
    return downloadTreeZip(resource.name, resources, resource.id)
  return downloadFile(resource)
}
