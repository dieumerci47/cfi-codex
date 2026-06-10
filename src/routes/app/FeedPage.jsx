import { Loader2, Sparkles } from 'lucide-react'
import { useFeed } from '@/lib/queries/social'
import { PostComposer } from '@/components/social/PostComposer'
import { PostCard } from '@/components/social/PostCard'

export default function FeedPage() {
  const { data: posts, isLoading } = useFeed()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Ton feed</h1>
        <p className="font-meta text-xs text-muted-foreground">
          ce que ta promo partage
        </p>
      </div>

      <PostComposer />

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts?.length ? (
        <div className="mt-4 space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Sparkles className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            Rien à afficher… pour l’instant
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Publie ton premier post ci-dessus, ou file dans l’Explorateur pour
            suivre des camarades.
          </p>
        </div>
      )}
    </div>
  )
}
