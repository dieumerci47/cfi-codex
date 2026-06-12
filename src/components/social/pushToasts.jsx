import { toast } from 'sonner'
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  FolderTree,
  FilePlus2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/social/UserAvatar'

/** Carte de toast « push » : avatar + titre + aperçu, cliquable. */
function PushCard({ id, actor, icon: Icon, accent, title, body, onClick }) {
  return (
    <button
      onClick={() => {
        toast.dismiss(id)
        onClick?.()
      }}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card/95 p-3 text-left shadow-lg shadow-black/25 backdrop-blur transition-colors hover:bg-accent/60"
    >
      <div className="relative shrink-0">
        <UserAvatar profile={actor} className="size-9" />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-background',
            accent,
          )}
        >
          <Icon className="size-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {body && <p className="truncate text-xs text-muted-foreground">{body}</p>}
      </div>
    </button>
  )
}

/** Toast d'un nouveau message reçu. */
export function pushMessageToast({ actor, title, body, onClick }) {
  toast.custom(
    (id) => (
      <PushCard
        id={id}
        actor={actor}
        icon={MessageCircle}
        accent="text-primary"
        title={title || actor?.full_name || `@${actor?.username}` || 'Nouveau message'}
        body={body}
        onClick={onClick}
      />
    ),
    { duration: 5000 },
  )
}

const NOTIF_META = {
  follow: { icon: UserPlus, accent: 'text-primary', text: 'a commencé à te suivre' },
  like: { icon: Heart, accent: 'text-ember', text: 'a aimé ta publication' },
  comment: {
    icon: MessageCircle,
    accent: 'text-primary',
    text: 'a commenté ta publication',
  },
  collection_invite: {
    icon: FolderTree,
    accent: 'text-primary',
    text: 't’a ajouté à une collection',
  },
  collection_change: {
    icon: FilePlus2,
    accent: 'text-ember',
    text: 'a modifié une collection',
  },
}

/** Toast d'une nouvelle notification reçue. */
export function pushNotifToast({ type, actor, detail, onClick }) {
  const m =
    NOTIF_META[type] ?? {
      icon: Bell,
      accent: 'text-primary',
      text: 'nouvelle notification',
    }
  const name = actor?.full_name || (actor?.username && `@${actor.username}`)
  toast.custom(
    (id) => (
      <PushCard
        id={id}
        actor={actor}
        icon={m.icon}
        accent={m.accent}
        title={name || 'Notification'}
        body={detail || m.text}
        onClick={onClick}
      />
    ),
    { duration: 5000 },
  )
}
