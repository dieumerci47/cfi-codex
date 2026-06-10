import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Heart, MessageCircle, UserPlus, FolderTree } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import {
  useNotifications,
  useUnreadNotifCount,
  useMarkNotifsRead,
} from '@/lib/queries/notifications'
import { UserAvatar } from '@/components/social/UserAvatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const META = {
  follow: { icon: UserPlus, color: 'text-primary', text: 'a commencé à te suivre' },
  like: { icon: Heart, color: 'text-ember', text: 'a aimé ta publication' },
  comment: { icon: MessageCircle, color: 'text-primary', text: 'a commenté ta publication' },
  collection_invite: {
    icon: FolderTree,
    color: 'text-primary',
    text: 't’a ajouté comme éditeur',
  },
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications } = useNotifications()
  const unread = useUnreadNotifCount()
  const markRead = useMarkNotifsRead()
  const navigate = useNavigate()

  const onOpenChange = (o) => {
    setOpen(o)
    if (o && unread > 0) markRead.mutate()
  }

  const go = (n) => {
    setOpen(false)
    if (n.type === 'follow') navigate(`/app/u/${n.actor?.username}`)
    else if (n.type === 'collection_invite' && n.collection)
      navigate(`/app/collections/${n.collection.id}`)
    else navigate('/app/me')
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-2.5">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="max-h-96 overflow-auto">
          {notifications?.length ? (
            notifications.map((n) => {
              const meta = META[n.type] ?? META.follow
              const Icon = meta.icon
              return (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/60',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <div className="relative">
                    <UserAvatar profile={n.actor} className="size-9" />
                    <span
                      className={cn(
                        'absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-card',
                        meta.color,
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">
                        {n.actor?.full_name || `@${n.actor?.username}`}
                      </span>{' '}
                      {meta.text}
                      {n.type === 'collection_invite' && n.collection && (
                        <span className="font-medium"> « {n.collection.title} »</span>
                      )}
                    </p>
                    <p className="font-meta text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-ember" />
                  )}
                </button>
              )
            })
          ) : (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Pas encore de notifications.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
