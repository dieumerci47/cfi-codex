import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Folder,
  FolderTree,
  Globe,
  Lock,
  Search,
  Star,
  StickyNote,
  Users,
} from 'lucide-react'

import { useDiscoverProfiles } from '@/lib/queries/social'
import {
  useSearchCourses,
  usePopularCollections,
} from '@/lib/queries/collections'
import { UserAvatar } from '@/components/social/UserAvatar'
import { FollowButton } from '@/components/social/FollowButton'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserListSkeleton } from '@/components/skeletons'

export default function ExplorePage() {
  const [search, setSearch] = useState('')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Explorer</h1>
      <p className="font-meta text-xs text-muted-foreground">
        trouve ta promo et fouille les cours
      </p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une personne ou un cours…"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="people" className="mt-5">
        <TabsList>
          <TabsTrigger value="people">Personnes</TabsTrigger>
          <TabsTrigger value="courses">Cours</TabsTrigger>
        </TabsList>

        <TabsContent value="people">
          <PeopleResults search={search} />
        </TabsContent>

        <TabsContent value="courses">
          <CourseResults search={search} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PeopleResults({ search }) {
  const { data: profiles, isLoading } = useDiscoverProfiles(search)

  if (isLoading) return <UserListSkeleton />
  if (!profiles?.length) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title="Personne pour l’instant"
        text={
          search
            ? 'Aucun résultat pour cette recherche.'
            : 'Quand d’autres élèves rejoindront Codex, ils apparaîtront ici.'
        }
      />
    )
  }

  return (
    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
      {profiles.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <Link to={`/app/u/${p.username}`}>
            <UserAvatar profile={p} className="size-11" />
          </Link>
          <Link to={`/app/u/${p.username}`} className="min-w-0 flex-1">
            <p className="truncate font-medium hover:text-primary">
              {p.full_name || `@${p.username}`}
            </p>
            <p className="truncate font-meta text-xs text-muted-foreground">
              @{p.username}
              {p.promo && ` · ${p.promo}`}
            </p>
          </Link>
          <FollowButton targetId={p.id} />
        </li>
      ))}
    </ul>
  )
}

function CourseResults({ search }) {
  const q = search.trim()
  // Sans recherche : on met en avant les cours publics les plus étoilés.
  if (q.length < 2) return <PopularCourses />
  return <CourseSearchResults q={q} />
}

function PopularCourses() {
  const { data: collections, isLoading } = usePopularCollections()
  if (isLoading) return <UserListSkeleton count={4} />
  if (!collections?.length) {
    return (
      <EmptyState
        icon={<FolderTree className="size-6" />}
        title="Aucun cours public"
        text="Quand des cours publics seront partagés, les plus étoilés s’afficheront ici."
      />
    )
  }
  return (
    <>
      <p className="mt-3 font-meta text-xs uppercase tracking-wide text-muted-foreground">
        Cours populaires
      </p>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              to={`/app/collections/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <FolderTree className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="truncate font-meta text-xs text-muted-foreground">
                  {c.visibility === 'private' ? (
                    <Lock className="inline size-3" />
                  ) : (
                    <Globe className="inline size-3" />
                  )}{' '}
                  {c.subject?.code ?? 'cours'}
                  {c.owner?.username && ` · @${c.owner.username}`}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 font-meta text-sm text-muted-foreground">
                <Star className="size-4" />
                {c.star_count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function CourseSearchResults({ q }) {
  const navigate = useNavigate()
  const { data: results, isLoading } = useSearchCourses(q)

  if (isLoading) return <UserListSkeleton count={4} />
  if (!results?.length) {
    return (
      <EmptyState
        icon={<FolderTree className="size-6" />}
        title="Aucun cours trouvé"
        text={`Rien ne correspond à « ${q} » dans les cours visibles.`}
      />
    )
  }

  return (
    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
      {results.map((r) => (
        <li key={`${r.result_kind}-${r.resource_id ?? r.collection_id}`}>
          <button
            onClick={() => navigate(`/app/collections/${r.collection_id}`)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60"
          >
            <ResultIcon kind={r.result_kind} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="truncate font-meta text-xs text-muted-foreground">
                {r.result_kind === 'collection'
                  ? 'cours'
                  : `dans ${r.collection_title}`}
                {r.snippet && ` · ${r.snippet}`}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ResultIcon({ kind }) {
  const cls = 'size-5 shrink-0'
  if (kind === 'collection') return <FolderTree className={`${cls} text-primary`} />
  if (kind === 'folder') return <Folder className={`${cls} text-ember`} />
  if (kind === 'note') return <StickyNote className={`${cls} text-primary`} />
  return <FileText className={`${cls} text-muted-foreground`} />
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
