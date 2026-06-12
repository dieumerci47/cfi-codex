import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Folder,
  FolderTree,
  Globe,
  Lock,
  Search,
  Sparkles,
  Star,
  StickyNote,
  Users,
  X,
} from 'lucide-react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/utils'
import { useSuggestedPeople, useSearchPeople } from '@/lib/queries/social'
import {
  useSearchCourses,
  usePopularCollections,
} from '@/lib/queries/collections'
import { RevealItem, prefersReducedMotion } from '@/components/motion'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'
import { FollowButton } from '@/components/social/FollowButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserListSkeleton } from '@/components/skeletons'

export default function ExplorePage() {
  const [search, setSearch] = useState('')
  const scope = useRef(null)
  const inputRef = useRef(null)

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
    <div ref={scope} className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div data-rise>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Explorer
        </h1>
        <p className="mt-0.5 font-meta text-xs text-muted-foreground">
          trouve ta promo et fouille les cours
        </p>
      </div>

      {/* Recherche — élément central */}
      <div data-rise className="group relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une personne ou un cours…"
          aria-label="Rechercher"
          className="h-12 w-full rounded-2xl border border-border bg-card/60 pl-11 pr-10 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_4px] focus:shadow-primary/10"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              inputRef.current?.focus()
            }}
            aria-label="Effacer"
            className="absolute right-3 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-90"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <Tabs data-rise defaultValue="people" className="mt-5">
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
  const q = search.trim()
  const searching = q.length >= 1
  const suggestions = useSuggestedPeople()
  const searchResults = useSearchPeople(q)
  const { data: profiles, isLoading } = searching ? searchResults : suggestions

  if (isLoading) return <UserListSkeleton />
  if (!profiles?.length) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title={searching ? 'Aucun résultat' : 'Personne à suggérer'}
        text={
          searching
            ? 'Aucune personne ne correspond à cette recherche.'
            : 'Quand d’autres élèves rejoindront Cirasphère, des suggestions apparaîtront ici.'
        }
      />
    )
  }

  return (
    <div className="mt-3 space-y-2.5">
      {!searching && (
        <p className="font-meta text-xs uppercase tracking-wide text-muted-foreground">
          Suggestions pour toi
        </p>
      )}
      {profiles.map((p, i) => {
        const reason = searching ? null : reasonFor(p)
        return (
          <RevealItem key={p.id} delay={Math.min(i, 8) * 0.04}>
            <div className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/20">
              <Link to={`/app/u/${p.username}`} className="shrink-0">
                <UserAvatar profile={p} className="size-12" />
              </Link>
              <Link to={`/app/u/${p.username}`} className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-medium group-hover:text-primary">
                  {p.full_name || `@${p.username}`}
                  <VerifiedBadge verified={p.is_verified} />
                </p>
                <p className="truncate font-meta text-xs text-muted-foreground">
                  @{p.username}
                  {p.promo && ` · ${p.promo}`}
                </p>
                {reason ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-primary/90">
                    <Sparkles className="size-3 shrink-0" />
                    {reason}
                  </p>
                ) : (
                  p.bio && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                      {p.bio}
                    </p>
                  )
                )}
              </Link>
              <FollowButton targetId={p.id} />
            </div>
          </RevealItem>
        )
      })}
    </div>
  )
}

/** Raison de suggestion lisible (promo > amis communs > popularité). */
function reasonFor(p) {
  if (p.same_promo) return 'Même promo'
  if (p.mutual_count > 0)
    return `Suivi par ${p.mutual_count} personne${
      p.mutual_count > 1 ? 's' : ''
    } que tu suis`
  if (p.follower_count > 0)
    return `${p.follower_count} abonné${p.follower_count > 1 ? 's' : ''}`
  return null
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
      <p className="mt-4 flex items-center gap-1.5 font-meta text-xs uppercase tracking-wide text-muted-foreground">
        <Star className="size-3.5 fill-ember text-ember" />
        Cours populaires
      </p>
      <div className="mt-2 space-y-2.5">
        {collections.map((c, i) => (
          <RevealItem key={c.id} delay={Math.min(i, 8) * 0.04}>
            <Link
              to={`/app/collections/${c.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/20"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-ember/15 text-primary transition-transform duration-200 group-hover:scale-105">
                <FolderTree className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium group-hover:text-primary">
                  {c.title}
                </p>
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
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ember/10 px-2 py-1 font-meta text-sm text-ember">
                <Star className="size-4 fill-ember" />
                {c.star_count}
              </span>
            </Link>
          </RevealItem>
        ))}
      </div>
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
    <div className="mt-3 space-y-2.5">
      {results.map((r, i) => (
        <RevealItem
          key={`${r.result_kind}-${r.resource_id ?? r.collection_id}`}
          delay={Math.min(i, 8) * 0.04}
        >
          <button
            onClick={() => navigate(`/app/collections/${r.collection_id}`)}
            className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/20"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary/60">
              <ResultIcon kind={r.result_kind} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium group-hover:text-primary">
                {r.name}
              </p>
              <p className="truncate font-meta text-xs text-muted-foreground">
                {r.result_kind === 'collection'
                  ? 'cours'
                  : `dans ${r.collection_title}`}
                {r.snippet && ` · ${r.snippet}`}
              </p>
            </div>
          </button>
        </RevealItem>
      ))}
    </div>
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
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-ember/15 text-primary">
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
