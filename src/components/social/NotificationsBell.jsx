import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  FolderTree,
  FilePlus2,
  CheckCheck,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import {
  useNotifications,
  useUnreadNotifCount,
  useMarkNotifsRead,
  useMarkNotifRead,
  useDeleteNotif,
} from '@/lib/queries/notifications'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const META = {
  follow: { icon: UserPlus, color: 'text-primary', text: 'a commencé à te suivre' },
  like: { icon: Heart, color: 'text-ember', text: 'a aimé ta publication' },
  comment: {
    icon: MessageCircle,
    color: 'text-primary',
    text: 'a commenté ta publication',
  },
  collection_invite: {
    icon: FolderTree,
    color: 'text-primary',
    text: 't’a ajouté comme éditeur de',
  },
  collection_change: {
    icon: FilePlus2,
    color: 'text-ember',
    text: 'a modifié',
  },
}

/** Destination du clic sur le corps d'une notification (le contenu concerné). */
function destOf(n) {
  switch (n.type) {
    case 'follow':
      return n.actor?.username ? `/app/u/${n.actor.username}` : '/app/explore'
    case 'like':
      return n.post_id ? `/app?post=${n.post_id}` : '/app'
    case 'comment':
      return n.post_id
        ? `/app?post=${n.post_id}${n.comment_id ? `&c=${n.comment_id}` : ''}`
        : '/app'
    case 'collection_invite':
      return n.collection ? `/app/collections/${n.collection.id}` : '/app/collections'
    case 'collection_change':
      return n.collection
        ? `/app/collections/${n.collection.id}${
            n.resource_id ? `?focus=${n.resource_id}` : ''
          }`
        : '/app/collections'
    default:
      return '/app'
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications } = useNotifications()
  const unread = useUnreadNotifCount()
  const markAll = useMarkNotifsRead()
  const markOne = useMarkNotifRead()
  const removeOne = useDeleteNotif()
  const navigate = useNavigate()

  const readOne = (n) => {
    if (!n.read) markOne.mutate(n.id)
  }

  const go = (n) => {
    setOpen(false)
    readOne(n)
    navigate(destOf(n))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'relative inline-flex size-9 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-ember px-1 font-meta text-[10px] font-semibold text-ember-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="font-semibold">
            Notifications
            {unread > 0 && (
              <span className="ml-1.5 font-meta text-xs font-normal text-muted-foreground">
                {unread} non lue{unread > 1 ? 's' : ''}
              </span>
            )}
          </h3>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-meta text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Tout marquer lu
            </button>
          )}
        </div>

        <div className="max-h-104 overflow-auto">
          {notifications?.length ? (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onGo={() => go(n)}
                onReadProfile={() => {
                  readOne(n)
                  setOpen(false)
                }}
                onDelete={() => removeOne.mutate(n.id)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
                <Bell className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Pas encore de notifications.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({ n, onGo, onReadProfile, onDelete }) {
  const meta = META[n.type] ?? META.follow
  const Icon = meta.icon
  const name = n.actor?.full_name || `@${n.actor?.username}`
  const profileHref = n.actor?.username ? `/app/u/${n.actor.username}` : null

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-accent/50',
        !n.read && 'bg-primary/5',
      )}
    >
      {/* liseré non-lu */}
      {!n.read && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-ember" />
      )}

      {/* supprimer la notification */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete?.()
        }}
        aria-label="Supprimer la notification"
        className="absolute right-1.5 top-1.5 z-10 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>

      {/* avatar -> profil */}
      {profileHref ? (
        <Link to={profileHref} onClick={onReadProfile} className="relative shrink-0">
          <UserAvatar profile={n.actor} className="size-9" />
          <span
            className={cn(
              'absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-background',
              meta.color,
            )}
          >
            <Icon className="size-3" />
          </span>
        </Link>
      ) : (
        <div className="relative shrink-0">
          <UserAvatar profile={n.actor} className="size-9" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {profileHref ? (
            <Link
              to={profileHref}
              onClick={onReadProfile}
              className="inline-flex items-center gap-1 font-medium hover:text-primary"
            >
              {name}
              <VerifiedBadge verified={n.actor?.is_verified} className="size-3" />
            </Link>
          ) : (
            <span className="font-medium">{name}</span>
          )}{' '}
          <button onClick={onGo} className="text-left hover:underline">
            {meta.text}
            {n.type === 'collection_change' && n.resource?.name && (
              <span className="font-medium"> {n.resource.name}</span>
            )}
            {(n.type === 'collection_invite' || n.type === 'collection_change') &&
              n.collection && (
                <span>
                  {' '}
                  dans <span className="font-medium">« {n.collection.title} »</span>
                </span>
              )}
          </button>
        </p>
        <button
          onClick={onGo}
          className="mt-0.5 block font-meta text-xs text-muted-foreground hover:text-foreground"
        >
          {formatDistanceToNow(new Date(n.created_at), {
            addSuffix: true,
            locale: fr,
          })}
        </button>
      </div>

      {!n.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ember transition-opacity group-hover:opacity-0" />
      )}
    </div>
  )
}
