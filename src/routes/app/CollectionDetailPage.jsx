import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Folder,
  FolderPlus,
  FolderUp,
  FileText,
  File as FileIcon,
  FileImage,
  Upload,
  Loader2,
  Lock,
  Globe,
  Trash2,
  StickyNote,
  MoreVertical,
  Pencil,
  UploadCloud,
  Users,
  Settings2,
  Eye,
  UserPlus,
  Shield,
  Star,
  Sparkles,
  Download,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useCollection,
  useResources,
  useCreateResource,
  useUploadFiles,
  useUploadFolder,
  useRenameResource,
  useDeleteResource,
  useUpdateCollection,
  useMyMembership,
  useCollectionMembers,
  useInviteMember,
  useRemoveMember,
  useToggleCollectionFollow,
  useToggleStar,
  useSubjects,
  useResourceSeen,
  useMarkResourcesSeen,
} from '@/lib/queries/collections'
import { ResourceViewer } from '@/components/ResourceViewer'
import { useConfirm } from '@/components/ConfirmProvider'
import { downloadResource, downloadTreeZip } from '@/lib/download'
import { CollectionDetailSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function CollectionDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: collection, isLoading } = useCollection(id)
  const { data: resources } = useResources(id)
  const { data: membership } = useMyMembership(id)
  const { data: seenMap } = useResourceSeen(id)
  const markSeen = useMarkResourcesSeen(id)
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus')

  const [folderId, setFolderId] = useState(null) // dossier courant (null = racine)
  const [viewing, setViewing] = useState(null)
  const [renaming, setRenaming] = useState(null) // ressource en cours de renommage
  const [isDragging, setIsDragging] = useState(false)
  const [flash, setFlash] = useState(null) // ressource surlignée (depuis une notif)

  // Édition en ligne de l'en-tête (titre, description, matière, portée)
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [metaSubject, setMetaSubject] = useState('')
  const [metaVisibility, setMetaVisibility] = useState('public')
  const updateCollection = useUpdateCollection()
  const { data: subjects } = useSubjects()
  const confirm = useConfirm()

  const upload = useUploadFiles(id)
  const uploadFolder = useUploadFolder(id)
  const del = useDeleteResource(id)
  const fileInput = useRef(null)
  const folderInput = useRef(null)
  const dragDepth = useRef(0) // compteur d'entrées/sorties pour un drag stable
  const busy = upload.isPending || uploadFolder.isPending

  const isOwner = collection && user?.id === collection.owner_id
  const role = isOwner ? 'owner' : membership?.role ?? null
  const canEdit = role === 'owner' || role === 'editor'

  const currentItems = useMemo(
    () => (resources ?? []).filter((r) => (r.parent_id ?? null) === folderId),
    [resources, folderId],
  )

  const breadcrumb = useMemo(
    () => buildBreadcrumb(resources ?? [], folderId),
    [resources, folderId],
  )

  // ── Modifications non consultées ────────────────────────────────────────
  const byId = useMemo(() => {
    const m = new Map()
    for (const r of resources ?? []) m.set(r.id, r)
    return m
  }, [resources])

  // Seuil : depuis que j'ai rejoint (membre) ou depuis la création (owner).
  const threshold = membership?.created_at ?? collection?.created_at

  // Ressources changées depuis le seuil que je n'ai pas encore vues.
  const unseenIds = useMemo(() => {
    const set = new Set()
    if (!resources || !threshold) return set
    const t = new Date(threshold).getTime()
    for (const r of resources) {
      if (new Date(r.updated_at).getTime() <= t) continue
      const s = seenMap?.get(r.id)
      if (!s || new Date(s).getTime() < new Date(r.updated_at).getTime())
        set.add(r.id)
    }
    return set
  }, [resources, seenMap, threshold])

  // Dossiers qui contiennent (à n'importe quelle profondeur) une nouveauté.
  const folderHasUnseen = useMemo(() => {
    const set = new Set()
    for (const rid of unseenIds) {
      let pid = byId.get(rid)?.parent_id
      while (pid) {
        set.add(pid)
        pid = byId.get(pid)?.parent_id
      }
    }
    return set
  }, [unseenIds, byId])

  // En ouvrant un dossier, ses éléments deviennent visibles → marqués vus.
  const markedRef = useRef(new Set())
  useEffect(() => {
    if (!resources) return
    const toMark = resources
      .filter(
        (r) =>
          unseenIds.has(r.id) &&
          (r.parent_id ?? null) === folderId &&
          !markedRef.current.has(r.id),
      )
      .map((r) => r.id)
    if (toMark.length) {
      toMark.forEach((x) => markedRef.current.add(x))
      markSeen.mutate(toMark)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, unseenIds, resources])

  // Lien profond depuis une notif (?focus=resourceId) : on ouvre le bon dossier.
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusId || !resources || focusedRef.current) return
    const r = byId.get(focusId)
    if (!r) return
    focusedRef.current = true
    setFolderId(r.parent_id ?? null)
    setFlash(focusId)
    const next = new URLSearchParams(params)
    next.delete('focus')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, resources, byId])

  // Retire le surlignage après un court instant.
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  if (isLoading) {
    return <CollectionDetailSkeleton />
  }

  if (!collection) {
    return (
      <div className="px-4 py-20 text-center text-muted-foreground">
        Collection introuvable ou privée.
      </div>
    )
  }

  const uploadFiles = async (files) => {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    try {
      await upload.mutateAsync({ files: list, parent_id: folderId })
      toast.success(
        list.length === 1
          ? `« ${list[0].name} » ajouté ✦`
          : `${list.length} fichiers ajoutés ✦`,
      )
    } catch (err) {
      toast.error(err.message ?? 'Échec de l’upload.')
    }
  }

  const onPickFiles = (e) => {
    const files = e.target.files
    e.target.value = ''
    uploadFiles(files)
  }

  const uploadFolderFiles = async (files) => {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    const topName =
      (list[0].webkitRelativePath || list[0]._relPath || '').split('/')[0] ||
      'Dossier'
    try {
      const res = await uploadFolder.mutateAsync({ files: list, parent_id: folderId })
      toast.success(`« ${topName} » importé — ${res.files} fichiers ✦`)
    } catch (err) {
      toast.error(err.message ?? 'Échec de l’import du dossier.')
    }
  }

  const onPickFolder = (e) => {
    const files = e.target.files
    e.target.value = ''
    uploadFolderFiles(files)
  }

  // Drag & drop robuste (compteur d'entrées) : reste fiable quel que soit
  // le contenu du dossier, y compris quand on survole des éléments enfants.
  const hasFiles = (e) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files')

  const onDragEnter = (e) => {
    if (!canEdit || !hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }
  const onDragOver = (e) => {
    if (!canEdit || !hasFiles(e)) return
    e.preventDefault() // indispensable à chaque dragover pour autoriser le drop
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = (e) => {
    if (!canEdit) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }
  const onDrop = (e) => {
    if (!canEdit) return
    e.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    // Capture des entrées de façon synchrone (elles expirent après le handler)
    const entries = e.dataTransfer.items
      ? Array.from(e.dataTransfer.items)
          .map((it) => it.webkitGetAsEntry?.())
          .filter(Boolean)
      : []
    if (entries.some((en) => en.isDirectory)) {
      collectDroppedEntries(entries).then((files) => {
        if (files.length) uploadFolderFiles(files)
      })
    } else {
      uploadFiles(e.dataTransfer.files)
    }
  }

  const onDelete = async (resource) => {
    const ok = await confirm({
      title: `Supprimer « ${resource.name} » ?`,
      description:
        resource.kind === 'folder'
          ? 'Le dossier et tout son contenu seront supprimés définitivement.'
          : 'Cette action est définitive.',
      confirmLabel: 'Supprimer',
    })
    if (!ok) return
    try {
      await del.mutateAsync(resource)
      toast.success('Supprimé')
    } catch (err) {
      toast.error(err.message ?? 'Échec de la suppression.')
    }
  }

  const openItem = (item) => {
    if (item.kind === 'folder') setFolderId(item.id)
    else setViewing(item)
  }

  const startEditMeta = () => {
    setMetaTitle(collection.title)
    setMetaDesc(collection.description ?? '')
    setMetaSubject(collection.subject_id ?? '')
    setMetaVisibility(collection.visibility)
    setEditingMeta(true)
  }

  const saveMeta = async () => {
    if (!metaTitle.trim()) {
      toast.error('Le titre est requis.')
      return
    }
    try {
      await updateCollection.mutateAsync({
        id: collection.id,
        title: metaTitle.trim(),
        description: metaDesc.trim() || null,
        subject_id: metaSubject || null,
        visibility: metaVisibility,
      })
      toast.success('Collection mise à jour ✦')
      setEditingMeta(false)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/collections">
          <ArrowLeft className="size-4" /> Mes cours
        </Link>
      </Button>

      {/* En-tête collection — bascule en champs éditables en place */}
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingMeta ? (
            <div className="space-y-3">
              <input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={80}
                placeholder="Titre de la collection"
                aria-label="Titre de la collection"
                className="w-full rounded-none border-0 border-b border-border bg-transparent pb-1 text-2xl font-semibold outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <Textarea
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="Description (optionnel)"
                aria-label="Description"
              />
              <div className="grid max-w-md grid-cols-2 gap-3">
                <select
                  value={metaSubject}
                  onChange={(e) => setMetaSubject(e.target.value)}
                  aria-label="Matière"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Matière —</option>
                  {subjects?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={metaVisibility}
                  onChange={(e) => setMetaVisibility(e.target.value)}
                  aria-label="Portée"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="public">Public (toute l’école)</option>
                  <option value="private">Privé (membres uniquement)</option>
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{collection.title}</h1>
                <RoleBadge role={role} />
              </div>
              {collection.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {collection.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 font-meta text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {collection.visibility === 'private' ? (
                    <>
                      <Lock className="size-3.5" /> privé
                    </>
                  ) : (
                    <>
                      <Globe className="size-3.5" /> public
                    </>
                  )}
                </span>
                {collection.subject?.code && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                    {collection.subject.code}
                  </span>
                )}
                {collection.owner?.username && (
                  <span>· @{collection.owner.username}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions selon le rôle */}
        <div className="flex shrink-0 items-center gap-2">
          {editingMeta ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingMeta(false)}
                disabled={updateCollection.isPending}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={saveMeta}
                disabled={updateCollection.isPending || !metaTitle.trim()}
              >
                {updateCollection.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Check className="size-4" /> Enregistrer
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <StarButton collection={collection} />
              <CollectionDownloadButton
                title={collection.title}
                resources={resources ?? []}
              />
              {isOwner && (
                <Button size="sm" variant="outline" onClick={startEditMeta}>
                  <Settings2 className="size-4" /> Modifier
                </Button>
              )}
              <MembersDialog collection={collection} isOwner={isOwner} />
              {!isOwner && (
                <FollowCollectionButton
                  collectionId={id}
                  isFollowing={role === 'follower'}
                  canEdit={canEdit}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Barre d'outils (propriétaire + éditeurs) */}
      {canEdit && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Importer des fichiers
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={onPickFiles}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => folderInput.current?.click()}
            disabled={busy}
          >
            <FolderUp className="size-4" /> Importer un dossier
          </Button>
          <input
            ref={folderInput}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={onPickFolder}
          />
          <NewFolderDialog collectionId={id} parentId={folderId} />
          <NewNoteDialog collectionId={id} parentId={folderId} />
        </div>
      )}

      {/* Fil d'ariane */}
      <div className="mt-6 flex flex-wrap items-center gap-1 font-meta text-sm">
        <button
          onClick={() => setFolderId(null)}
          className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {collection.title.toLowerCase().replace(/\s+/g, '-')}/
        </button>
        {breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button
              onClick={() => setFolderId(b.id)}
              className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {b.name}
            </button>
          </span>
        ))}
      </div>

      {/* Bandeau des nouveautés non consultées */}
      {unseenIds.size > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 font-meta text-xs text-ember">
          <Sparkles className="size-3.5 shrink-0" />
          {unseenIds.size} modification{unseenIds.size > 1 ? 's' : ''} non
          consultée{unseenIds.size > 1 ? 's' : ''} — les dossiers concernés sont
          marqués, ouvre-les pour voir ce qui a changé.
        </div>
      )}

      {/* Contenu du dossier courant — zone de glisser-déposer */}
      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative mt-3 min-h-32 overflow-hidden rounded-xl border bg-card/40 transition-colors',
          isDragging
            ? 'border-primary border-dashed bg-primary/5'
            : 'border-border',
        )}
      >
        {/* Overlay glisser-déposer */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
            <UploadCloud className="size-8 text-primary" />
            <p className="font-meta text-sm text-primary">
              Dépose tes fichiers ici
            </p>
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 font-meta text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />{' '}
            {uploadFolder.isPending ? 'import du dossier…' : 'import en cours…'}
          </div>
        )}

        <ul className="divide-y divide-border">
          {currentItems.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {folderId ? 'Dossier vide.' : 'Cette collection est vide.'}
              {canEdit && (
                <span className="mt-1 block font-meta text-xs">
                  glisse des fichiers ici, ou utilise les boutons ci-dessus
                </span>
              )}
            </li>
          )}
          {currentItems.map((item) => {
            const isNew = unseenIds.has(item.id)
            const hasInside =
              item.kind === 'folder' && folderHasUnseen.has(item.id)
            return (
            <li
              key={item.id}
              className={cn(
                'group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60',
                flash === item.id && 'bg-ember/10 ring-1 ring-inset ring-ember/40',
              )}
            >
              {renaming?.id === item.id ? (
                <ResourceRenameRow
                  item={item}
                  collectionId={id}
                  onDone={() => setRenaming(null)}
                />
              ) : (
                <>
                  <button
                    onClick={() => openItem(item)}
                    className="flex flex-1 items-center gap-3 overflow-hidden text-left"
                  >
                    <span className="relative shrink-0">
                      <ResourceIcon item={item} />
                      {(isNew || hasInside) && (
                        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-ember ring-2 ring-card" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'truncate font-meta text-sm',
                        (isNew || hasInside) && 'font-medium text-foreground',
                      )}
                    >
                      {item.name}
                    </span>
                    {isNew && (
                      <span className="shrink-0 rounded-full bg-ember/15 px-1.5 py-0.5 font-meta text-[10px] font-semibold text-ember">
                        nouveau
                      </span>
                    )}
                    {item.kind === 'file' && item.size_bytes != null && (
                      <span className="shrink-0 font-meta text-xs text-muted-foreground">
                        {formatSize(item.size_bytes)}
                      </span>
                    )}
                  </button>
                  <RowDownloadButton item={item} resources={resources ?? []} />
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
                        aria-label={`Actions sur ${item.name}`}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRenaming(item)}>
                          <Pencil className="size-4" /> Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 className="size-4" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </li>
            )
          })}
        </ul>
      </div>

      <ResourceViewer
        resource={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
      />
    </div>
  )
}

function ResourceIcon({ item }) {
  if (item.kind === 'folder') return <Folder className="size-5 text-ember" />
  if (item.kind === 'note') return <StickyNote className="size-5 text-primary" />
  const mime = item.mime_type || ''
  if (mime.startsWith('image/'))
    return <FileImage className="size-5 text-chart-3" />
  if (mime === 'application/pdf')
    return <FileText className="size-5 text-destructive" />
  return <FileIcon className="size-5 text-muted-foreground" />
}

function StarButton({ collection }) {
  const toggle = useToggleStar(collection.id)
  const starred = collection.starred_by_me
  return (
    <Button
      size="sm"
      variant={starred ? 'default' : 'outline'}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(starred)}
      aria-label={starred ? 'Retirer mon étoile' : 'Étoiler ce cours'}
    >
      <Star className={cn('size-4', starred && 'fill-current')} />
      {collection.star_count ?? 0}
    </Button>
  )
}

function RoleBadge({ role }) {
  if (role === 'editor')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-meta text-xs text-primary">
        <Shield className="size-3" /> éditeur
      </span>
    )
  if (role === 'follower')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 font-meta text-xs text-ember">
        <Eye className="size-3" /> abonné
      </span>
    )
  return null
}

function FollowCollectionButton({ collectionId, isFollowing, canEdit }) {
  const toggle = useToggleCollectionFollow(collectionId)
  if (canEdit) return null // un éditeur n'a pas besoin de "suivre"

  return (
    <Button
      size="sm"
      variant={isFollowing ? 'outline' : 'default'}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(isFollowing)}
    >
      {toggle.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <Eye className="size-4" /> Suivi
        </>
      ) : (
        <>
          <Eye className="size-4" /> Suivre
        </>
      )}
    </Button>
  )
}

/** Télécharge un fichier / une note / un dossier (zip) depuis sa ligne. */
function RowDownloadButton({ item, resources }) {
  const [busy, setBusy] = useState(false)
  const run = async (e) => {
    e.stopPropagation()
    setBusy(true)
    try {
      await downloadResource(item, resources)
    } catch (err) {
      toast.error(err.message ?? 'Échec du téléchargement.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={run}
      disabled={busy}
      aria-label={`Télécharger ${item.name}`}
      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 disabled:opacity-100"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </button>
  )
}

/** Télécharge toute la collection en .zip. */
function CollectionDownloadButton({ title, resources }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await downloadTreeZip(title, resources, null)
    } catch (err) {
      toast.error(err.message ?? 'Échec du téléchargement.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={run}
      disabled={busy || resources.length === 0}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Télécharger
    </Button>
  )
}

function MembersDialog({ collection, isOwner }) {
  const [open, setOpen] = useState(false)
  const { data: members } = useCollectionMembers(collection.id)
  const invite = useInviteMember(collection.id)
  const remove = useRemoveMember(collection.id)
  const confirm = useConfirm()

  const [username, setUsername] = useState('')

  const removeMember = async (member) => {
    const ok = await confirm({
      title: 'Retirer ce membre ?',
      description: `${
        member.full_name || `@${member.username}`
      } perdra l'accès à cette collection.`,
      confirmLabel: 'Retirer',
    })
    if (!ok) return
    remove.mutate(member.id)
  }

  const editors = members?.filter((m) => m.role === 'editor') ?? []
  const followers = members?.filter((m) => m.role === 'follower') ?? []
  const count = (members?.length ?? 0) + 1 // + propriétaire

  const onInvite = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    try {
      await invite.mutateAsync({ username, role: 'editor' })
      toast.success('Collaborateur ajouté ✦')
      setUsername('')
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Users className="size-4" /> {count}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Membres de la collection</DialogTitle>
          <DialogDescription>
            Invite des collaborateurs (éditeurs) ou gère les abonnés.
          </DialogDescription>
        </DialogHeader>

        {/* Invitation (propriétaire) */}
        {isOwner && (
          <form onSubmit={onInvite} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite">Inviter un collaborateur (éditeur)</Label>
              <Input
                id="invite"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="pseudo de l’élève"
                autoCapitalize="none"
              />
            </div>
            <Button type="submit" disabled={invite.isPending || !username.trim()}>
              {invite.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
            </Button>
          </form>
        )}

        <div className="space-y-4">
          {/* Propriétaire */}
          <MemberRow
            profile={collection.owner}
            label="propriétaire"
            icon={<Shield className="size-3" />}
          />

          {editors.length > 0 && (
            <Section title="Éditeurs">
              {editors.map((m) => (
                <MemberRow
                  key={m.user.id}
                  profile={m.user}
                  label="éditeur"
                  onRemove={isOwner ? () => removeMember(m.user) : undefined}
                />
              ))}
            </Section>
          )}

          {followers.length > 0 && (
            <Section title="Abonnés">
              {followers.map((m) => (
                <MemberRow
                  key={m.user.id}
                  profile={m.user}
                  label="abonné"
                  onRemove={isOwner ? () => removeMember(m.user) : undefined}
                />
              ))}
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-1.5 font-meta text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function MemberRow({ profile, label, icon, onRemove }) {
  if (!profile) return null
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {profile.full_name || `@${profile.username}`}
        </p>
        <p className="truncate font-meta text-xs text-muted-foreground">
          @{profile.username}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 font-meta text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
          aria-label="Retirer"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Renommage en ligne d'une ressource : la ligne devient un champ. Entrée ou
 * perte de focus valide, Échap annule. Pas de popup.
 */
function ResourceRenameRow({ item, collectionId, onDone }) {
  const rename = useRenameResource(collectionId)
  const [name, setName] = useState(item.name)
  const inputRef = useRef(null)
  const committed = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    // Sélectionne le nom sans l'extension pour un renommage rapide
    const dot = item.name.lastIndexOf('.')
    if (item.kind === 'file' && dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [item])

  const commit = async () => {
    if (committed.current) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === item.name) {
      committed.current = true
      onDone()
      return
    }
    committed.current = true
    try {
      await rename.mutateAsync({ id: item.id, name: trimmed })
      toast.success('Renommé')
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
    onDone()
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      <ResourceIcon item={item} />
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            committed.current = true
            onDone()
          }
        }}
        disabled={rename.isPending}
        aria-label="Nouveau nom"
        className="min-w-0 flex-1 rounded-md border border-primary/50 bg-background px-2 py-1 font-meta text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
      />
      {rename.isPending && (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

function NewFolderDialog({ collectionId, parentId }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateResource(collectionId)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await create.mutateAsync({ kind: 'folder', name: name.trim(), parent_id: parentId })
      toast.success('Dossier créé')
      setName('')
      setOpen(false)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FolderPlus className="size-4" /> Dossier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
          <DialogDescription>
            Crée un dossier dans l’emplacement courant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="td-graphes"
            autoFocus
          />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewNoteDialog({ collectionId, parentId }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const create = useCreateResource(collectionId)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const fileName = name.trim().endsWith('.md') ? name.trim() : `${name.trim()}.md`
    try {
      await create.mutateAsync({
        kind: 'note',
        name: fileName,
        parent_id: parentId,
        note_content: content,
      })
      toast.success('Note créée ✦')
      setName('')
      setContent('')
      setOpen(false)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <StickyNote className="size-4" /> Note
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle note (markdown)</DialogTitle>
          <DialogDescription>
            Rédige une note en markdown, enregistrée dans le dossier courant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-name">Nom</Label>
            <Input
              id="note-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="resume-chapitre-1"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-content">Contenu</Label>
            <Textarea
              id="note-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'# Mon résumé\n\n- point clé\n- **important**'}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---- glisser-déposer de dossiers (File System Entries API) ----
function readEntriesBatch(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej))
    // chemin relatif synthétique réutilisé par useUploadFolder
    file._relPath = prefix + entry.name
    out.push(file)
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    let batch
    do {
      batch = await readEntriesBatch(reader)
      for (const child of batch) {
        await walkEntry(child, prefix + entry.name + '/', out)
      }
    } while (batch.length > 0)
  }
}

async function collectDroppedEntries(entries) {
  const out = []
  for (const en of entries) await walkEntry(en, '', out)
  return out
}

// ---- helpers ----
function buildBreadcrumb(resources, folderId) {
  const byId = new Map(resources.map((r) => [r.id, r]))
  const chain = []
  let cur = folderId ? byId.get(folderId) : null
  while (cur) {
    chain.unshift({ id: cur.id, name: cur.name })
    cur = cur.parent_id ? byId.get(cur.parent_id) : null
  }
  return chain
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
