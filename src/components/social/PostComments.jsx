import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { useAddComment, useComments, useDeleteComment } from '@/lib/queries/social'
import { useMyProfile } from '@/lib/queries/profile'
import { shortTime } from '@/lib/time'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'

/**
 * Commentaires sous le post (façon Instagram, sans popup).
 * - 2 commentaires max par défaut (les plus récents).
 * - « Voir les N commentaires » déplie tout ; au-delà de 5, la zone défile.
 * - Suppression possible pour l'auteur du commentaire ou l'auteur du post.
 */
export function PostComments({
  postId,
  postAuthorId,
  count,
  expanded,
  onToggle,
  inputRef,
}) {
  const { data: comments, isLoading } = useComments(count > 0 ? postId : null)
  const list = comments ?? []
  const visible = expanded ? list : list.slice(-2)
  const scrollable = expanded && list.length > 5

  return (
    <div className="mt-2 space-y-2.5">
      {count > 0 &&
        (isLoading && !list.length ? (
          <div className="flex py-1">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {!expanded && count > 2 && (
              <button
                onClick={onToggle}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Voir les {count} commentaires
              </button>
            )}

            <div
              className={cn(
                'space-y-3',
                scrollable && 'max-h-72 overflow-y-auto pr-1',
              )}
            >
              {visible.map((c) => (
                <CommentRow
                  key={c.id}
                  c={c}
                  postId={postId}
                  postAuthorId={postAuthorId}
                />
              ))}
            </div>

            {expanded && (
              <button
                onClick={onToggle}
                className="font-meta text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Masquer les commentaires
              </button>
            )}
          </>
        ))}

      <CommentComposer postId={postId} inputRef={inputRef} />
    </div>
  )
}

function CommentRow({ c, postId, postAuthorId }) {
  const { user } = useAuth()
  const del = useDeleteComment(postId)
  const confirm = useConfirm()
  const canDelete =
    !c._optimistic &&
    (c.author_id === user?.id ||
      c.author?.id === user?.id ||
      postAuthorId === user?.id)

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Supprimer ce commentaire ?',
      confirmLabel: 'Supprimer',
    })
    if (!ok) return
    try {
      await del.mutateAsync(c.id)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <div className="group/c flex gap-2.5">
      <Link to={`/app/u/${c.author?.username}`} className="shrink-0">
        <UserAvatar profile={c.author} className="size-7" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <Link
            to={`/app/u/${c.author?.username}`}
            className="mr-1 inline-flex items-center gap-1 font-medium hover:text-primary"
          >
            {c.author?.full_name || `@${c.author?.username}`}
            <VerifiedBadge verified={c.author?.is_verified} className="size-3" />
          </Link>
          <span className="text-foreground/90">{c.body}</span>
        </p>
        <p className="mt-0.5 font-meta text-[11px] text-muted-foreground">
          {shortTime(c.created_at)}
        </p>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          disabled={del.isPending}
          aria-label="Supprimer le commentaire"
          className="mt-0.5 shrink-0 self-start rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-ember focus-visible:opacity-100 group-hover/c:opacity-100 disabled:opacity-50"
        >
          {del.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

function CommentComposer({ postId, inputRef }) {
  const { data: profile } = useMyProfile()
  const add = useAddComment(postId)
  const [text, setText] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      await add.mutateAsync(body)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
      setText(body)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2.5 pt-0.5">
      <UserAvatar profile={profile} className="size-7" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ajouter un commentaire…"
        autoComplete="off"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {text.trim() && (
        <button
          type="submit"
          disabled={add.isPending}
          className="shrink-0 text-sm font-semibold text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Publier
        </button>
      )}
    </form>
  )
}
