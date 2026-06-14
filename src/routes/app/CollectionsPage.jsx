import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderTree,
  Lock,
  Globe,
  Plus,
  Loader2,
  Clock,
  BookMarked,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/utils'
import { friendlyError } from '@/lib/errors'
import {
  useCollections,
  useCreateCollection,
  useSubjects,
  useMemberCollections,
  useCollectionsUnseen,
} from '@/lib/queries/collections'
import { RevealItem, prefersReducedMotion } from '@/components/motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { CollectionGridSkeleton } from '@/components/skeletons'
import { toast } from 'sonner'

export default function CollectionsPage() {
  const mine = useCollections()
  const editing = useMemberCollections('editor')
  const followed = useMemberCollections('follower')
  const { data: unseen } = useCollectionsUnseen()
  const scope = useRef(null)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.from('[data-rise]', {
        y: 14,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power3.out',
      })
    },
    { scope },
  )

  return (
    <div ref={scope} className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div data-rise className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Mes cours
          </h1>
          <p className="mt-0.5 font-meta text-xs text-muted-foreground">
            tes collections · accessibles partout, pour toujours
          </p>
        </div>
        <NewCollectionDialog />
      </div>

      <Tabs data-rise defaultValue="mine" className="mt-6">
        <TabsList>
          <TabsTrigger value="mine">
            Mes cours ({mine.data?.length ?? 0})
            {tabHasUnseen(mine.data, unseen) && <TabDot />}
          </TabsTrigger>
          <TabsTrigger value="editing">
            Je collabore ({editing.data?.length ?? 0})
            {tabHasUnseen(editing.data, unseen) && <TabDot />}
          </TabsTrigger>
          <TabsTrigger value="followed">
            Suivis ({followed.data?.length ?? 0})
            {tabHasUnseen(followed.data, unseen) && <TabDot />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-5">
          <CollectionGrid query={mine} unseen={unseen} empty={<EmptyState />} />
        </TabsContent>
        <TabsContent value="editing" className="mt-5">
          <CollectionGrid
            query={editing}
            unseen={unseen}
            empty={
              <SimpleEmpty label="Aucune collaboration pour l’instant. Quand on t’invitera à éditer un cours, il apparaîtra ici." />
            }
          />
        </TabsContent>
        <TabsContent value="followed" className="mt-5">
          <CollectionGrid
            query={followed}
            unseen={unseen}
            empty={
              <SimpleEmpty label="Tu ne suis aucun cours. Ouvre un cours public et clique sur « Suivre »." />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Un onglet a-t-il au moins une collection avec des modifs non vues ? */
function tabHasUnseen(list, unseen) {
  if (!list || !unseen) return false
  return list.some((c) => (unseen.get(c.id) ?? 0) > 0)
}

function TabDot() {
  return (
    <span className="ml-1.5 inline-block size-1.5 shrink-0 rounded-full bg-ember align-middle" />
  )
}

function CollectionGrid({ query, empty, unseen }) {
  if (query.isLoading) {
    return <CollectionGridSkeleton />
  }
  if (!query.data?.length) return empty
  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2">
      {query.data.map((c, i) => (
        <CollectionCard
          key={c.id}
          collection={c}
          index={i}
          unseenCount={unseen?.get(c.id) ?? 0}
        />
      ))}
    </div>
  )
}

function SimpleEmpty({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function CollectionCard({ collection, index = 0, unseenCount = 0 }) {
  const isPrivate = collection.visibility === 'private'
  return (
    <RevealItem delay={Math.min(index, 8) * 0.04} className="h-full">
      <Link
        to={`/app/collections/${collection.id}`}
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card/60 p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20',
          unseenCount > 0
            ? 'border-ember/40 hover:border-ember/60'
            : 'border-border hover:border-primary/30',
        )}
      >
        {/* halo au survol */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

        <div className="flex items-center justify-between">
          <span className="relative inline-flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-ember/15 text-primary transition-transform duration-200 group-hover:scale-105">
            <FolderTree className="size-5" />
            {unseenCount > 0 && (
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-ember ring-2 ring-card" />
            )}
          </span>
          {unseenCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 font-meta text-[11px] font-semibold text-ember">
              {unseenCount} nouveau{unseenCount > 1 ? 'x' : ''}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-meta text-[11px]',
                isPrivate ? 'bg-ember/12 text-ember' : 'bg-primary/12 text-primary',
              )}
            >
              {isPrivate ? (
                <>
                  <Lock className="size-3" /> privé
                </>
              ) : (
                <>
                  <Globe className="size-3" /> public
                </>
              )}
            </span>
          )}
        </div>

        <h3 className="mt-4 text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
          {collection.title}
        </h3>
        {collection.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {collection.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4 font-meta text-xs text-muted-foreground">
          {collection.subject?.code && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
              {collection.subject.code}
            </span>
          )}
          {collection.owner?.username && (
            <span className="truncate">@{collection.owner.username}</span>
          )}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1">
            <Clock className="size-3" />
            {formatDistanceToNow(new Date(collection.updated_at), {
              addSuffix: false,
              locale: fr,
            })}
          </span>
        </div>
      </Link>
    </RevealItem>
  )
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-ember/15 text-primary">
        <BookMarked className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Ton premier cours t’attend</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Crée une collection pour ranger tes PDF, images et notes. Tu les
        retrouveras sur n’importe quel appareil.
      </p>
      <div className="mt-6">
        <NewCollectionDialog />
      </div>
    </div>
  )
}

function NewCollectionDialog() {
  const [open, setOpen] = useState(false)
  const { data: subjects } = useSubjects()
  const create = useCreateCollection()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [visibility, setVisibility] = useState('public')

  const reset = () => {
    setTitle('')
    setDescription('')
    setSubjectId('')
    setVisibility('public')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await create.mutateAsync({
        title: title.trim(),
        description,
        subject_id: subjectId,
        visibility,
      })
      toast.success('Collection créée ✦')
      reset()
      setOpen(false)
    } catch (err) {
      toast.error(friendlyError(err, 'Erreur lors de la création.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="glow-primary">
          <Plus className="size-4" /> Nouvelle collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle collection</DialogTitle>
          <DialogDescription>
            Un dépôt pour ranger tes cours. Tu pourras y ajouter dossiers,
            fichiers et notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Algo & structures de données"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">
              Description <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que contient cette collection…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Matière</Label>
              <select
                id="subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">—</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="visibility">Visibilité</Label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="public">Public (toute l’école)</option>
                <option value="private">Privé (moi seul)</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
