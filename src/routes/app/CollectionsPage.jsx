import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderTree,
  Lock,
  Globe,
  Plus,
  Loader2,
  BookMarked,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

import {
  useCollections,
  useCreateCollection,
  useSubjects,
  useMemberCollections,
} from '@/lib/queries/collections'
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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mes cours</h1>
          <p className="font-meta text-xs text-muted-foreground">
            tes collections · accessibles partout, pour toujours
          </p>
        </div>
        <NewCollectionDialog />
      </div>

      <Tabs defaultValue="mine" className="mt-6">
        <TabsList>
          <TabsTrigger value="mine">Mes cours</TabsTrigger>
          <TabsTrigger value="editing">
            Je collabore ({editing.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="followed">
            Suivis ({followed.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-5">
          <CollectionGrid
            query={mine}
            empty={<EmptyState />}
          />
        </TabsContent>
        <TabsContent value="editing" className="mt-5">
          <CollectionGrid
            query={editing}
            empty={
              <SimpleEmpty label="Aucune collaboration pour l’instant. Quand on t’invitera à éditer un cours, il apparaîtra ici." />
            }
          />
        </TabsContent>
        <TabsContent value="followed" className="mt-5">
          <CollectionGrid
            query={followed}
            empty={
              <SimpleEmpty label="Tu ne suis aucun cours. Ouvre un cours public et clique sur « Suivre »." />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CollectionGrid({ query, empty }) {
  if (query.isLoading) {
    return <CollectionGridSkeleton />
  }
  if (!query.data?.length) return empty
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {query.data.map((c) => (
        <CollectionCard key={c.id} collection={c} />
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

function CollectionCard({ collection }) {
  const isPrivate = collection.visibility === 'private'
  return (
    <Link
      to={`/app/collections/${collection.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <FolderTree className="size-5" />
        </span>
        <span className="inline-flex items-center gap-1 font-meta text-xs text-muted-foreground">
          {isPrivate ? (
            <>
              <Lock className="size-3.5" /> privé
            </>
          ) : (
            <>
              <Globe className="size-3.5" /> public
            </>
          )}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold group-hover:text-primary">
        {collection.title}
      </h3>
      {collection.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {collection.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 font-meta text-xs text-muted-foreground">
        {collection.subject?.code && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {collection.subject.code}
          </span>
        )}
        {collection.owner?.username && (
          <span>@{collection.owner.username}</span>
        )}
        <span className="ml-auto">
          maj.{' '}
          {formatDistanceToNow(new Date(collection.updated_at), {
            addSuffix: true,
            locale: fr,
          })}
        </span>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
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
      toast.error(err.message ?? 'Erreur lors de la création.')
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
