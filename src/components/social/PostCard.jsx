import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderTree,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'

import { cn } from '@/lib/utils'
import { shortTime } from '@/lib/time'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDeletePost, useToggleLike } from '@/lib/queries/social'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'
import { PostComments } from '@/components/social/PostComments'
import { ImageLightbox } from '@/components/social/ImageLightbox'
import { StatusViewer } from '@/components/social/StatusBar'
import { useStories } from '@/lib/queries/statuses'
import { burst, prefersReducedMotion } from '@/components/motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function PostCard({ post, highlight = false, defaultExpanded = false }) {
  const { user } = useAuth()
  const toggleLike = useToggleLike()
  const del = useDeletePost()
  const { groups, storyOf } = useStories()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [lightbox, setLightbox] = useState(null)
  const [storyIndex, setStoryIndex] = useState(null)
  const isOwner = user?.id === post.author_id
  const story = storyOf(post.author_id)

  // Déplie les commentaires si on arrive via une notif de commentaire
  useEffect(() => {
    if (defaultExpanded) setExpanded(true)
  }, [defaultExpanded])

  const likeBtnRef = useRef(null)
  const heartIconRef = useRef(null)
  const bigHeartRef = useRef(null)
  const clickTimer = useRef(null)
  const commentInputRef = useRef(null)

  const onDelete = async () => {
    try {
      await del.mutateAsync(post.id)
      toast.success('Post supprimé')
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  const popHeart = () => {
    if (prefersReducedMotion() || !heartIconRef.current) return
    gsap.fromTo(
      heartIconRef.current,
      { scale: 0.6 },
      { scale: 1, duration: 0.5, ease: 'back.out(4)' },
    )
  }

  const onLike = () => {
    const willLike = !post.liked_by_me
    toggleLike.mutate({ postId: post.id, liked: post.liked_by_me })
    if (willLike) {
      popHeart()
      burst(likeBtnRef.current)
    }
  }

  const flashBigHeart = () => {
    const el = bigHeartRef.current
    if (!el || prefersReducedMotion()) return
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.25,
        ease: 'back.out(2)',
        onComplete: () =>
          gsap.to(el, { opacity: 0, scale: 1.15, duration: 0.4, delay: 0.35 }),
      },
    )
  }

  const onDoubleLike = () => {
    if (!post.liked_by_me) {
      toggleLike.mutate({ postId: post.id, liked: false })
      popHeart()
      burst(likeBtnRef.current)
    }
    flashBigHeart()
  }

  // Distingue simple clic (lightbox) du double clic (like)
  const onImgClick = (idx) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      onDoubleLike()
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        setLightbox(idx)
      }, 240)
    }
  }

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        'group scroll-mt-24 rounded-xl border border-border bg-card/60 p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/20',
        highlight && 'border-primary/60 ring-2 ring-primary/40',
      )}
    >
      {/* En-tête */}
      <header className="flex items-center gap-3">
        {story ? (
          <button
            type="button"
            onClick={() => setStoryIndex(story.index)}
            aria-label={`Voir la story de ${post.author?.full_name || post.author?.username}`}
            className={cn(
              'block shrink-0 rounded-full p-0.5 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring',
              story.allSeen
                ? 'bg-border'
                : 'bg-linear-to-tr from-primary to-ember',
            )}
          >
            <span className="block rounded-full border-2 border-card">
              <UserAvatar profile={post.author} />
            </span>
          </button>
        ) : (
          <Link to={`/app/u/${post.author?.username}`}>
            <UserAvatar profile={post.author} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/app/u/${post.author?.username}`}
            className="inline-flex items-center gap-1 font-medium hover:text-primary"
          >
            {post.author?.full_name || `@${post.author?.username}`}
            <VerifiedBadge verified={post.author?.is_verified} />
          </Link>
          <p className="font-meta text-xs text-muted-foreground">
            @{post.author?.username} · {shortTime(post.created_at)}
          </p>
        </div>
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
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

      {/* Médias — clic = agrandir, double-clic = like */}
      {post.media?.length > 0 && (
        <div className="relative mt-3">
          <div
            className={cn(
              'grid gap-1.5 overflow-hidden rounded-lg',
              post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
            )}
          >
            {post.media.map((m, idx) => (
              <img
                key={m.id}
                src={m.url}
                alt=""
                loading="lazy"
                onClick={() => onImgClick(idx)}
                className="max-h-96 w-full cursor-zoom-in object-cover transition-opacity hover:opacity-95"
              />
            ))}
          </div>
          {/* Gros cœur du double-clic */}
          <div
            ref={bigHeartRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
          >
            <Heart className="size-24 fill-white text-white drop-shadow-lg" />
          </div>
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
          ref={likeBtnRef}
          onClick={onLike}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent active:scale-95',
            post.liked_by_me ? 'text-ember' : 'text-muted-foreground',
          )}
        >
          <Heart
            ref={heartIconRef}
            className={cn('size-4', post.liked_by_me && 'fill-ember')}
          />
          {post.like_count > 0 && post.like_count}
        </button>
        <button
          onClick={() => {
            setExpanded(true)
            setTimeout(() => commentInputRef.current?.focus(), 0)
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent active:scale-95"
        >
          <MessageCircle className="size-4" />
          {post.comment_count > 0 && post.comment_count}
        </button>
      </footer>

      <PostComments
        postId={post.id}
        postAuthorId={post.author_id}
        count={post.comment_count}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        inputRef={commentInputRef}
      />

      {lightbox != null && (
        <ImageLightbox
          images={post.media}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {storyIndex != null && (
        <StatusViewer
          groups={groups}
          startIndex={storyIndex}
          onClose={() => setStoryIndex(null)}
        />
      )}
    </article>
  )
}
