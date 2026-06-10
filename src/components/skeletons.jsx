import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Carte de post (feed, profil). */
export function PostCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  )
}

/** Barre de statuts (cercles + libellé) pendant le chargement. */
export function StatusBarSkeleton({ count = 5 }) {
  return (
    <div className="flex gap-3 overflow-hidden pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  )
}

/** Liste de posts. */
export function FeedSkeleton({ count = 3 }) {
  return (
    <div className="mt-4 space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Ligne « utilisateur » (Explore) : avatar + nom + bouton. */
export function UserListSkeleton({ count = 6 }) {
  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </li>
      ))}
    </ul>
  )
}

/** Grille de collections (cours). */
export function CollectionGridSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

/** Page profil complète. */
export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl pb-6">
      <div className="h-36 bg-card/40 sm:h-44" />
      <div className="px-4 sm:px-6">
        <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          <Skeleton className="size-24 rounded-2xl ring-4 ring-background sm:size-28" />
          <Skeleton className="mb-1 h-8 w-32 rounded-md" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-3 h-3.5 w-3/4" />
          <div className="mt-4 flex gap-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <FeedSkeleton count={2} />
      </div>
    </div>
  )
}

/** Page détail d'une collection : en-tête + liste de ressources. */
export function CollectionDetailSkeleton({ rows = 5 }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Skeleton className="h-8 w-24 rounded-md" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card/40">
        <ul className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="h-3.5 w-56" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Liste des conversations (messages). */
export function ConversationListSkeleton({ count = 6 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border/60 px-4 py-3"
        >
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Fil de messages (bulles alternées). */
export function MessageThreadSkeleton({ count = 6 }) {
  const widths = ['w-40', 'w-56', 'w-32', 'w-48', 'w-44', 'w-36']
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => {
        const mine = i % 2 === 1
        return (
          <div key={i} className={cn('flex', mine && 'justify-end')}>
            <Skeleton className={cn('h-9 rounded-2xl', widths[i % widths.length])} />
          </div>
        )
      })}
    </div>
  )
}
