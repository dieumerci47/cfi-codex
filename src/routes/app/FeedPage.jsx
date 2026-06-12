import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useFeed } from '@/lib/queries/social'
import { PostComposer } from '@/components/social/PostComposer'
import { PostCard } from '@/components/social/PostCard'
import { StatusBar } from '@/components/social/StatusBar'
import { FeedSkeleton } from '@/components/skeletons'
import { RevealItem } from '@/components/motion'

export default function FeedPage() {
  const { data: posts, isLoading } = useFeed()
  const [params, setParams] = useSearchParams()

  // Lien profond depuis une notification (like/commentaire) :
  // ?post=<id>&c=<commentId> → on défile vers le post, on le surligne,
  // et on déplie ses commentaires si un commentaire est ciblé.
  const [target, setTarget] = useState(null) // { id, expand }

  useEffect(() => {
    const postId = params.get('post')
    if (!postId) return
    setTarget({ id: postId, expand: !!params.get('c') })
    // On nettoie l'URL pour ne pas re-surligner au rafraîchissement
    const next = new URLSearchParams(params)
    next.delete('post')
    next.delete('c')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    if (!target || isLoading) return
    const el = document.getElementById(`post-${target.id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setTarget(null), 2400)
    return () => clearTimeout(t)
  }, [target, isLoading, posts])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Ton feed</h1>
        <p className="font-meta text-xs text-muted-foreground">
          ce que ta promo partage
        </p>
      </div>

      {/* Statuts éphémères 24 h */}
      <div className="mb-4 rounded-xl border border-border bg-card/40 p-3">
        <StatusBar />
      </div>

      <PostComposer />

      {isLoading ? (
        <FeedSkeleton />
      ) : posts?.length ? (
        <div className="mt-4 space-y-4">
          {posts.map((p) => (
            <RevealItem key={p.id}>
              <PostCard
                post={p}
                highlight={target?.id === p.id}
                defaultExpanded={target?.id === p.id && target.expand}
              />
            </RevealItem>
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
