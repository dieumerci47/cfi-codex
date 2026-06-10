import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderTree,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDeletePost, useToggleLike } from '@/lib/queries/social'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'
import { CommentsDialog } from '@/components/social/CommentsDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function PostCard({ post }) {
  const { user } = useAuth()
  const toggleLike = useToggleLike()
  const del = useDeletePost()
  const [showComments, setShowComments] = useState(false)
  const isOwner = user?.id === post.author_id

  const onDelete = async () => {
    try {
      await del.mutateAsync(post.id)
      toast.success('Post supprimé')
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card/60 p-4">
      {/* En-tête */}
      <header className="flex items-center gap-3">
        <Link to={`/app/u/${post.author?.username}`}>
          <UserAvatar profile={post.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/app/u/${post.author?.username}`}
            className="inline-flex items-center gap-1 font-medium hover:text-primary"
          >
            {post.author?.full_name || `@${post.author?.username}`}
            <VerifiedBadge verified={post.author?.is_verified} />
          </Link>
          <p className="font-meta text-xs text-muted-foreground">
            @{post.author?.username} ·{' '}
            {formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
              locale: fr,
            })}
          </p>
        </div>
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
              >
                <Trash2 className="size-4" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* Corps */}
      {post.body && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
          {post.body}
        </p>
      )}

      {/* Médias */}
      {post.media?.length > 0 && (
        <div
          className={cn(
            'mt-3 grid gap-1.5 overflow-hidden rounded-lg',
            post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {post.media.map((m) => (
            <img
              key={m.id}
              src={m.url}
              alt=""
              loading="lazy"
              className="max-h-96 w-full object-cover"
            />
          ))}
        </div>
      )}

      {/* Collection partagée */}
      {post.collection && (
        <Link
          to={`/app/collections/${post.collection.id}`}
          className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-background/60 px-4 py-3 transition-colors hover:border-primary/40"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <FolderTree className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-meta text-xs text-muted-foreground">
              collection partagée
            </p>
            <p className="truncate font-medium">{post.collection.title}</p>
          </div>
        </Link>
      )}

      {/* Actions */}
      <footer className="mt-3 flex items-center gap-1 border-t border-border pt-3">
        <button
          onClick={() =>
            toggleLike.mutate({ postId: post.id, liked: post.liked_by_me })
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent',
            post.liked_by_me ? 'text-ember' : 'text-muted-foreground',
          )}
        >
          <Heart
            className={cn('size-4', post.liked_by_me && 'fill-ember')}
          />
          {post.like_count > 0 && post.like_count}
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <MessageCircle className="size-4" />
          {post.comment_count > 0 && post.comment_count}
        </button>
      </footer>

      <CommentsDialog
        postId={post.id}
        open={showComments}
        onOpenChange={setShowComments}
      />
    </article>
  )
}
