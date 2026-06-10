import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

import { useAddComment, useComments } from '@/lib/queries/social'
import { UserAvatar } from '@/components/social/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function CommentsDialog({ postId, open, onOpenChange }) {
  const { data: comments, isLoading } = useComments(open ? postId : null)
  const add = useAddComment(postId)
  const [text, setText] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await add.mutateAsync(text)
      setText('')
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] flex-col p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle>Commentaires</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments?.length ? (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <UserAvatar profile={c.author} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link
                      to={`/app/u/${c.author?.username}`}
                      className="font-medium hover:text-primary"
                    >
                      @{c.author?.username}
                    </Link>{' '}
                    <span className="font-meta text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </p>
                  <p className="text-sm text-foreground/90">{c.body}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sois le premier à commenter.
            </p>
          )}
        </div>

        <form
          onSubmit={submit}
          className="flex items-center gap-2 border-t border-border px-4 py-3"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un commentaire…"
          />
          <Button type="submit" size="icon" disabled={add.isPending || !text.trim()}>
            {add.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
