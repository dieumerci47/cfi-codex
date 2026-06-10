import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  X,
  Image as ImageIcon,
  Type,
  Loader2,
  Eye,
  Trash2,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useStatusFeed,
  useCreateStatus,
  useMarkStatusViewed,
  useDeleteStatus,
  useStatusViewers,
  useReplyToStatus,
} from '@/lib/queries/statuses'
import { UserAvatar } from '@/components/social/UserAvatar'
import { StatusBarSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const BG_COLORS = ['#0f7a4f', '#bf6a12', '#2563a8', '#8a4fb0', '#b5403a', '#15140f']
const STORY_MS = 5000

export function StatusBar() {
  const { data, isLoading } = useStatusFeed()
  const [viewer, setViewer] = useState(null) // { groups, index }

  const mine = data?.mine
  const others = data?.others ?? []
  const orderedGroups = [...(mine ? [mine] : []), ...others]

  const openViewer = (groupId) => {
    const index = orderedGroups.findIndex((g) => g.author.id === groupId)
    if (index >= 0) setViewer({ groups: orderedGroups, index })
  }

  // Premier chargement : on montre des cercles fantômes plutôt que du vide.
  if (isLoading && !data) return <StatusBarSkeleton />

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <AddStatusTile mine={mine} onViewMine={() => openViewer(mine?.author.id)} />

      {others.map((g) => (
        <StatusTile key={g.author.id} group={g} onClick={() => openViewer(g.author.id)} />
      ))}

      {viewer && (
        <StatusViewer
          groups={viewer.groups}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  )
}

function StatusTile({ group, onClick }) {
  return (
    <button onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span
        className={cn(
          'rounded-full p-0.5',
          group.allSeen
            ? 'bg-border'
            : 'bg-linear-to-tr from-primary to-ember',
        )}
      >
        <span className="block rounded-full border-2 border-background">
          <UserAvatar profile={group.author} className="size-14" />
        </span>
      </span>
      <span className="w-full truncate text-center font-meta text-[11px] text-muted-foreground">
        {group.author.username}
      </span>
    </button>
  )
}

function AddStatusTile({ mine, onViewMine }) {
  const { user } = useAuth()
  const hasStatus = mine && mine.statuses.length > 0

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <div className="relative">
        {hasStatus ? (
          <button
            onClick={onViewMine}
            className={cn(
              'block rounded-full p-0.5',
              mine.allSeen ? 'bg-border' : 'bg-linear-to-tr from-primary to-ember',
            )}
          >
            <span className="block rounded-full border-2 border-background">
              <UserAvatar profile={mine.author} className="size-14" />
            </span>
          </button>
        ) : (
          <span className="block rounded-full p-0.5">
            <UserAvatar
              profile={{ id: user?.id, username: 'moi' }}
              className="size-14 opacity-90"
            />
          </span>
        )}
        <AddStatusDialog
          trigger={
            <button
              className="absolute -bottom-0.5 -right-0.5 inline-flex size-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
              aria-label="Ajouter un statut"
            >
              <Plus className="size-3" />
            </button>
          }
        />
      </div>
      <span className="font-meta text-[11px] text-muted-foreground">Ton statut</span>
    </div>
  )
}

function AddStatusDialog({ trigger }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('photo') // 'photo' | 'texte'
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [bg, setBg] = useState(BG_COLORS[0])
  const create = useCreateStatus()

  const reset = () => {
    setMode('photo')
    setFile(null)
    setCaption('')
    setBg(BG_COLORS[0])
  }

  const submit = async (e) => {
    e.preventDefault()
    if (mode === 'photo' && !file) return
    if (mode === 'texte' && !caption.trim()) return
    try {
      await create.mutateAsync({
        file: mode === 'photo' ? file : null,
        caption,
        background: mode === 'texte' ? bg : null,
      })
      toast.success('Statut publié — visible 24 h ✦')
      reset()
      setOpen(false)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouveau statut</DialogTitle>
          <DialogDescription>
            Une photo ou un texte, visible 24 h par tes amis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          <button
            onClick={() => setMode('photo')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
              mode === 'photo' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            <ImageIcon className="size-4" /> Photo
          </button>
          <button
            onClick={() => setMode('texte')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
              mode === 'texte' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Type className="size-4" /> Texte
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'photo' ? (
            <>
              {file ? (
                <div className="relative overflow-hidden rounded-lg">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="max-h-64 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="absolute right-2 top-2 rounded-full bg-background/80 p-1 backdrop-blur"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50">
                  <ImageIcon className="size-7" />
                  <span className="text-sm">Choisir une image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Légende (optionnel)"
              />
            </>
          ) : (
            <>
              <div
                className="flex min-h-40 items-center justify-center rounded-lg p-4 text-center text-lg font-semibold text-white"
                style={{ background: bg }}
              >
                {caption || 'Ton texte ici…'}
              </div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="Qu’as-tu en tête ?"
              />
              <div className="flex gap-2">
                {BG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBg(c)}
                    className={cn(
                      'size-7 rounded-full border-2',
                      bg === c ? 'border-foreground' : 'border-transparent',
                    )}
                    style={{ background: c }}
                    aria-label={'couleur ' + c}
                  />
                ))}
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Publier'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatusViewer({ groups, startIndex, onClose }) {
  const { user } = useAuth()
  const [gi, setGi] = useState(startIndex)
  const [si, setSi] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false) // saisie réponse
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const markViewed = useMarkStatusViewed()
  const reply = useReplyToStatus()
  const elapsed = useRef(0)
  const [replyText, setReplyText] = useState('')

  const group = groups[gi]
  const status = group?.statuses[si]
  const isMine = group?.author.id === user?.id
  const frozen = paused || confirmDelete || showViewers
  // Compteur de vues du statut courant (auteur uniquement)
  const { data: myViewers } = useStatusViewers(isMine ? status?.id : null)
  const viewCount = myViewers?.length ?? 0

  const next = () => {
    if (si < group.statuses.length - 1) setSi((s) => s + 1)
    else if (gi < groups.length - 1) {
      setGi((g) => g + 1)
      setSi(0)
    } else onClose()
  }
  const prev = () => {
    if (si > 0) setSi((s) => s - 1)
    else if (gi > 0) {
      const pg = groups[gi - 1]
      setGi((g) => g - 1)
      setSi(pg.statuses.length - 1)
    }
  }

  // Reset + marquage vu à chaque changement de statut
  useEffect(() => {
    if (!status) return
    elapsed.current = 0
    setProgress(0)
    setReplyText('')
    setPaused(false)
    setConfirmDelete(false)
    setShowViewers(false)
    if (!isMine && !status.seen) markViewed.mutate(status.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si])

  // Minuteur (gelé pendant saisie réponse / confirmation / liste des vues)
  useEffect(() => {
    if (!status || frozen) return
    const tick = setInterval(() => {
      elapsed.current += 50
      const pct = Math.min(100, (elapsed.current / STORY_MS) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(tick)
        next()
      }
    }, 50)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, frozen])

  const sendReply = async (e) => {
    e.preventDefault()
    const body = replyText.trim()
    if (!body) return
    setReplyText('')
    try {
      await reply.mutateAsync({ statusId: status.id, body })
      toast.success(`Réponse envoyée à @${group.author.username}`)
    } catch (err) {
      toast.error(err.message ?? 'Échec de l’envoi.')
    } finally {
      setPaused(false)
    }
  }

  if (!status) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90">
      <div className="relative flex h-full w-full max-w-md flex-col">
        {/* Barres de progression */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2">
          {group.statuses.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: i < si ? '100%' : i === si ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* En-tête */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-3 pt-5">
          <UserAvatar profile={group.author} className="size-9 ring-2 ring-white/40" />
          <div className="flex-1 text-white">
            <p className="text-sm font-semibold">
              {group.author.full_name || `@${group.author.username}`}
            </p>
          </div>
          {isMine && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-full p-1.5 text-white"
              aria-label="Supprimer"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button onClick={onClose} className="rounded-full p-1.5 text-white" aria-label="Fermer">
            <X className="size-6" />
          </button>
        </div>

        {/* Contenu */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          style={!status.url ? { background: status.background || '#15140f' } : undefined}
        >
          {status.url ? (
            <img src={status.url} alt="" className="max-h-full w-full object-contain" />
          ) : (
            <p className="px-8 text-center text-2xl font-semibold text-white">
              {status.caption}
            </p>
          )}

          <button onClick={prev} className="absolute inset-y-0 left-0 w-1/3" aria-label="Précédent" />
          <button onClick={next} className="absolute inset-y-0 right-0 w-2/3" aria-label="Suivant" />

          {status.url && status.caption && (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/70 to-transparent p-4 pb-6 text-center text-white">
              {status.caption}
            </p>
          )}
        </div>

        {/* Pied : réponse (autres) ou compteur de vues (auteur) */}
        {isMine ? (
          <button
            onClick={() => setShowViewers(true)}
            className="z-20 flex items-center justify-center gap-2 bg-black/40 px-4 py-3 text-white/80 transition-colors hover:bg-black/60"
          >
            <Eye className="size-4" />
            <span className="font-meta text-xs">
              {viewCount > 0
                ? `Vu par ${viewCount} ${viewCount > 1 ? 'personnes' : 'personne'}`
                : 'Voir qui a vu ce statut'}
            </span>
          </button>
        ) : (
          <form onSubmit={sendReply} className="z-20 flex items-center gap-2 bg-black/40 px-3 py-2.5">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              placeholder={`Répondre à @${group.author.username}…`}
              className="border-white/20 bg-white/10 text-white placeholder:text-white/50"
            />
            <Button type="submit" size="icon" disabled={!replyText.trim() || reply.isPending}>
              {reply.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        )}

        {/* Panneau de confirmation de suppression (interne à la visionneuse) */}
        {confirmDelete && (
          <ConfirmDeletePanel
            status={status}
            onCancel={() => setConfirmDelete(false)}
            onDeleted={onClose}
          />
        )}

        {/* Panneau "vu par" (interne à la visionneuse) */}
        {showViewers && (
          <ViewersPanel statusId={status.id} onClose={() => setShowViewers(false)} />
        )}
      </div>
    </div>
  )
}

function ConfirmDeletePanel({ status, onCancel, onDeleted }) {
  const del = useDeleteStatus()
  const remove = async () => {
    try {
      await del.mutateAsync(status)
      toast.success('Statut supprimé')
      onDeleted()
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-xs rounded-2xl bg-card p-5 text-center">
        <p className="text-base font-semibold">Supprimer ce statut ?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Action définitive : le statut et ses vues seront supprimés.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={del.isPending}>
            Annuler
          </Button>
          <Button variant="destructive" className="flex-1" onClick={remove} disabled={del.isPending}>
            {del.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ViewersPanel({ statusId, onClose }) {
  const { data: viewers } = useStatusViewers(statusId)
  const count = viewers?.length ?? 0
  return (
    <>
      <button
        className="absolute inset-0 z-30 bg-black/50"
        onClick={onClose}
        aria-label="Fermer"
      />
      <div className="absolute inset-x-0 bottom-0 z-40 max-h-[60%] overflow-auto rounded-t-2xl bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">
            Vu par {count} {count > 1 ? 'personnes' : 'personne'}
          </h3>
        </div>
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Personne n’a encore vu ce statut.
          </p>
        ) : (
          <div className="space-y-1">
            {viewers.map((v) => (
              <div key={v.viewer?.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                <UserAvatar profile={v.viewer} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {v.viewer?.full_name || `@${v.viewer?.username}`}
                  </p>
                  <p className="truncate font-meta text-xs text-muted-foreground">
                    @{v.viewer?.username}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
