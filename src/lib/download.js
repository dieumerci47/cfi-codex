import { supabase } from '@/lib/supabase'

const RESOURCES_BUCKET = 'resources'

// iOS Safari ignore l'attribut `download` (il ouvre le fichier au lieu de
// l'enregistrer). On le détecte pour adapter la stratégie de téléchargement.
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPad iPadOS se présente comme un Mac mais avec un écran tactile
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Clique un lien <a> vers une URL (téléchargement piloté par le serveur). */
function triggerUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Déclenche l'enregistrement d'un Blob généré côté client (note .md, .zip).
 * Sur iOS, l'attribut `download` est inopérant : on passe par le partage natif
 * (« Enregistrer dans Fichiers ») quand c'est possible.
 */
async function saveBlob(blob, filename) {
  if (isIOS && navigator.canShare) {
    const file = new File([blob], filename, {
      type: blob.type || 'application/octet-stream',
    })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return // l'utilisateur a annulé
        // sinon on retombe sur la méthode classique ci-dessous
      }
    }
  }
  const url = URL.createObjectURL(blob)
  triggerUrl(url, filename)
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

/**
 * Télécharge un fichier seul. On génère une URL signée avec
 * `Content-Disposition: attachment` (option `download`) : le navigateur
 * télécharge le fichier directement — y compris sur iOS, où l'attribut
 * `download` d'un lien blob est ignoré.
 */
export async function downloadFile(resource) {
  const name = safeName(resource.name)
  const { data, error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .createSignedUrl(resource.storage_path, 3600, { download: name })
  if (error) throw error
  triggerUrl(data.signedUrl, name)
}

/** Télécharge une note markdown (.md). */
export function downloadNote(resource) {
  const base = safeName(resource.name)
  const name = base.toLowerCase().endsWith('.md') ? base : `${base}.md`
  return saveBlob(
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
  await saveBlob(blob, `${safeName(rootName)}.zip`)
}

/** Télécharge la bonne chose selon le type de ressource. */
export async function downloadResource(resource, resources) {
  if (resource.kind === 'note') return downloadNote(resource)
  if (resource.kind === 'folder')
    return downloadTreeZip(resource.name, resources, resource.id)
  return downloadFile(resource)
}
