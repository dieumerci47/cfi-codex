import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users } from 'lucide-react'

import { useDiscoverProfiles } from '@/lib/queries/social'
import { UserAvatar } from '@/components/social/UserAvatar'
import { FollowButton } from '@/components/social/FollowButton'
import { Input } from '@/components/ui/input'
import { UserListSkeleton } from '@/components/skeletons'

export default function ExplorePage() {
  const [search, setSearch] = useState('')
  const { data: profiles, isLoading } = useDiscoverProfiles(search)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Explorer</h1>
      <p className="font-meta text-xs text-muted-foreground">
        trouve et suis ta promo
      </p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un pseudo ou un nom…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <UserListSkeleton />
      ) : profiles?.length ? (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
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
      ) : (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Users className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Personne pour l’instant</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {search
              ? 'Aucun résultat pour cette recherche.'
              : 'Quand d’autres élèves rejoindront Codex, ils apparaîtront ici.'}
          </p>
        </div>
      )}
    </div>
  )
}
