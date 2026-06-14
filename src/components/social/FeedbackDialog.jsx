import { useState } from 'react'
import { Loader2, MessageSquareHeart } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { friendlyError } from '@/lib/errors'
import { useSubmitFeedback } from '@/lib/queries/feedback'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CATEGORIES = [
  { value: 'ux', label: 'Expérience' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idée' },
  { value: 'other', label: 'Autre' },
]

/** Formulaire de retour utilisateur → table `feedback` (lue par l'admin). */
export function FeedbackDialog({ open, onOpenChange }) {
  const submit = useSubmitFeedback()
  const [category, setCategory] = useState('ux')
  const [message, setMessage] = useState('')

  const reset = () => {
    setCategory('ux')
    setMessage('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    try {
      await submit.mutateAsync({ category, message })
      toast.success('Merci pour ton retour ✦')
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(friendlyError(err, 'Échec de l’envoi.'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="size-5 text-primary" />
            Donner mon avis
          </DialogTitle>
          <DialogDescription>
            Un souci, une idée, quelque chose qui te gêne dans l’interface ?
            Dis-le-nous, on lit tout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 font-meta text-sm transition-colors',
                  category === c.value
                    ? 'border-primary/40 bg-primary/12 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={1000}
            autoFocus
            placeholder="Ce que tu aimes, ce qui coince, ce que tu aimerais voir…"
          />
          <p className="text-right font-meta text-xs text-muted-foreground">
            {message.length}/1000
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submit.isPending || !message.trim()}>
              {submit.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Envoyer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
