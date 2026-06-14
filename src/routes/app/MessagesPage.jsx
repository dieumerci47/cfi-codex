import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  LogOut,
  MessageSquarePlus,
  MoreVertical,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { format, isSameDay, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/utils'
import { friendlyError } from '@/lib/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useMarkRead,
  useStartDM,
  useCreateGroup,
  useLeaveConversation,
  useDeleteConversation,
} from '@/lib/queries/chat'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFriends } from '@/lib/queries/social'
import { useStories } from '@/lib/queries/statuses'
import {
  ConversationListSkeleton,
  MessageThreadSkeleton,
} from '@/components/skeletons'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'
import { StatusViewer } from '@/components/social/StatusBar'
import { useConfirm } from '@/components/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function dayLabel(d) {
  const date = new Date(d)
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return 'Hier'
  const s = format(date, 'EEEE d MMMM', { locale: fr })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Horodatage compact de la liste : heure si aujourd'hui, sinon Hier / date. */
function listTime(d) {
  const date = new Date(d)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Hier'
  return format(date, 'dd/MM/yy')
}

/** Menu d'actions d'une conversation (liste ou en-tête du fil). */
function ConversationMenu({ conv, isActive, variant = 'row' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const leave = useLeaveConversation()
  const del = useDeleteConversation()
  const markRead = useMarkRead()
  const confirm = useConfirm()

  const isGroup = conv.is_group
  const owner = conv.created_by === user?.id
  const busy = leave.isPending || del.isPending

  const remove = async () => {
    const ok = await confirm(
      isGroup
        ? owner
          ? {
              title: 'Supprimer le groupe ?',
              description:
                'Le groupe et tous ses messages seront supprimés pour tout le monde.',
              confirmLabel: 'Supprimer',
            }
          : {
              title: 'Quitter le groupe ?',
              description: 'Tu ne recevras plus ses messages.',
              confirmLabel: 'Quitter',
            }
        : {
            title: 'Supprimer la conversation ?',
            description: 'Elle disparaîtra de ta liste.',
            confirmLabel: 'Supprimer',
          },
    )
    if (!ok) return
    try {
      if (isGroup && owner) await del.mutateAsync(conv.id)
      else await leave.mutateAsync(conv.id)
      toast.success(
        isGroup ? (owner ? 'Groupe supprimé' : 'Groupe quitté') : 'Conversation supprimée',
      )
      if (isActive) navigate('/app/messages')
    } catch (e) {
      toast.error(friendlyError(e, 'Action impossible pour le moment.'))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent',
          variant === 'row' &&
            'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100',
        )}
        aria-label="Actions de la conversation"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {variant === 'header' && (
          <DropdownMenuItem onClick={() => navigate('/app/messages')}>
            <X className="size-4" /> Fermer
          </DropdownMenuItem>
        )}
        {conv.unread > 0 && (
          <DropdownMenuItem onClick={() => markRead.mutate(conv.id)}>
            <Check className="size-4" /> Marquer comme lu
          </DropdownMenuItem>
        )}
        {(variant === 'header' || conv.unread > 0) && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" disabled={busy} onClick={remove}>
          {isGroup ? (
            owner ? (
              <>
                <Trash2 className="size-4" /> Supprimer le groupe
              </>
            ) : (
              <>
                <LogOut className="size-4" /> Quitter le groupe
              </>
            )
          ) : (
            <>
              <Trash2 className="size-4" /> Supprimer
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function MessagesPage() {
  const { id } = useParams()

  return (
    <div className="mx-auto h-[calc(100dvh-7rem)] w-full max-w-5xl lg:h-[calc(100dvh-3.5rem)] lg:px-4 lg:py-4">
      <div className="grid h-full lg:grid-cols-[20rem_1fr] lg:gap-4">
        {/* Liste — cachée sur mobile quand un fil est ouvert */}
        <div className={cn('h-full min-h-0', id && 'hidden lg:block')}>
          <ConversationList activeId={id} />
        </div>

        {/* Fil — caché sur mobile quand aucun fil n'est ouvert */}
        <div className={cn('h-full min-h-0', !id && 'hidden lg:block')}>
          {id ? (
            <ChatThread key={id} conversationId={id} />
          ) : (
            <EmptyThread />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyThread() {
  return (
    <div className="hidden h-full flex-col items-center justify-center rounded-xl border border-border bg-card/40 lg:flex">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <Send className="size-6" />
      </span>
      <p className="mt-4 text-sm font-medium">Tes conversations</p>
      <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
        Sélectionne une discussion à gauche, ou démarres-en une nouvelle.
      </p>
    </div>
  )
}

function ConversationList({ activeId }) {
  const { user } = useAuth()
  const { data: conversations, isLoading } = useConversations()
  const navigate = useNavigate()
  const listRef = useRef(null)
  const { groups, storyOf } = useStories()
  const [viewerIndex, setViewerIndex] = useState(null)

  useGSAP(
    () => {
      if (reduced()) return
      gsap.from('.conv-row', {
        y: 10,
        opacity: 0,
        duration: 0.35,
        stagger: 0.035,
        ease: 'power2.out',
      })
    },
    { scope: listRef, dependencies: [conversations?.length] },
  )

  return (
    <div className="flex h-full flex-col lg:rounded-xl lg:border lg:border-border lg:bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="font-display text-lg font-semibold">Messages</h1>
        <NewConversationDialog />
      </div>

      <div ref={listRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations?.length ? (
          conversations.map((c) => {
            const active = activeId === c.id
            const mineLast = c.lastMessage?.sender_id === user?.id
            const otherId = c.otherMembers?.[0]?.id
            const story = !c.is_group && otherId ? storyOf(otherId) : null
            return (
              <div
                key={c.id}
                className={cn(
                  'conv-row group relative flex items-center transition-colors',
                  active
                    ? 'bg-primary/10'
                    : c.unread > 0
                      ? 'bg-ember/10 hover:bg-ember/15'
                      : 'hover:bg-accent/60',
                )}
              >
                {/* Barre d'accent sur la conversation active */}
                <span
                  className={cn(
                    'absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <div className="py-3 pl-4">
                  <ConversationAvatar
                    conv={c}
                    story={story}
                    onClick={
                      story
                        ? () => setViewerIndex(story.index)
                        : () => navigate(`/app/messages/${c.id}`)
                    }
                  />
                </div>
                <button
                  onClick={() => navigate(`/app/messages/${c.id}`)}
                  className="flex min-w-0 flex-1 items-center py-3 pl-3 pr-10 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <span
                          className={cn(
                            'truncate',
                            c.unread > 0 ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {c.displayName}
                        </span>
                        {!c.is_group && (
                          <VerifiedBadge
                            verified={c.otherMembers?.[0]?.is_verified}
                            className="size-3.5"
                          />
                        )}
                      </span>
                      {c.lastMessage && (
                        <span className="shrink-0 font-meta text-[11px] text-muted-foreground group-hover:opacity-0">
                          {listTime(c.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          c.unread > 0
                            ? 'font-medium text-foreground/90'
                            : 'text-muted-foreground',
                        )}
                      >
                        {c.lastMessage && (c.is_group || mineLast) && (
                          <span className="text-muted-foreground">
                            {c.lastMessage.senderName} :{' '}
                          </span>
                        )}
                        {c.lastMessage
                          ? c.lastMessage.body || 'Pièce jointe'
                          : 'Nouvelle conversation'}
                      </span>
                      {c.unread > 0 && (
                        <span className="relative flex size-5 shrink-0 items-center justify-center">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember/50 motion-reduce:animate-none" />
                          <span className="relative flex size-5 items-center justify-center rounded-full bg-ember font-meta text-[10px] font-semibold text-ember-foreground">
                            {c.unread > 9 ? '9+' : c.unread}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Menu d'actions (apparaît au survol, en haut à droite) */}
                <div className="absolute right-2 top-2">
                  <ConversationMenu conv={c} isActive={active} />
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aucune conversation. Démarre une discussion avec le bouton
            ci-dessus, ou depuis le profil d’un élève.
          </div>
        )}
      </div>

      {viewerIndex != null && (
        <StatusViewer
          groups={groups}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}

/**
 * Avatar d'une conversation. Un anneau dégradé signifie que la personne a une
 * story active ; cliquer ouvre la story (via `onClick`).
 */
function ConversationAvatar({ conv, className = 'size-10', story, onClick }) {
  const hasStory = !!story
  const inner = conv.is_group ? (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/12 text-primary',
        className,
      )}
    >
      <Users className="size-5" />
    </span>
  ) : (
    <UserAvatar profile={conv.otherMembers[0]} className={className} />
  )

  const content = hasStory ? (
    <span
      className={cn(
        'block rounded-full p-0.5',
        story.allSeen ? 'bg-border' : 'bg-linear-to-tr from-primary to-ember',
      )}
    >
      <span className="block rounded-full border-2 border-background">{inner}</span>
    </span>
  ) : (
    inner
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={hasStory ? 'Voir la story' : 'Ouvrir la conversation'}
        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </button>
    )
  }
  return content
}

function ChatThread({ conversationId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: conversation } = useConversation(conversationId)
  const { data: messages, isLoading } = useMessages(conversationId)
  const send = useSendMessage(conversationId)
  const markRead = useMarkRead()

  const { groups, storyOf } = useStories()
  const [viewerIndex, setViewerIndex] = useState(null)

  const bottomRef = useRef(null)
  const threadRef = useRef(null)
  const firstRender = useRef(true)

  // Réinitialise l'animation d'entrée quand on change de conversation
  useEffect(() => {
    firstRender.current = true
  }, [conversationId])

  // Auto-scroll en bas + marquage "lu"
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages?.length) markRead.mutate(conversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, conversationId])

  // Entrée des messages : stagger au premier rendu, "pop" sur chaque nouveau
  useGSAP(
    () => {
      if (reduced()) return
      const rows = gsap.utils.toArray('.msg-row')
      if (!rows.length) return
      if (firstRender.current) {
        gsap.from(rows, {
          y: 14,
          opacity: 0,
          duration: 0.4,
          stagger: 0.03,
          ease: 'power3.out',
        })
        firstRender.current = false
      } else {
        gsap.from(rows[rows.length - 1], {
          y: 16,
          scale: 0.96,
          opacity: 0,
          duration: 0.38,
          ease: 'back.out(1.5)',
        })
      }
    },
    { scope: threadRef, dependencies: [messages?.length] },
  )

  const onSend = async (body) => {
    await send.mutateAsync(body)
  }

  const headerOtherId = conversation?.otherMembers?.[0]?.id
  const headerStory =
    conversation && !conversation.is_group && headerOtherId
      ? storyOf(headerOtherId)
      : null

  return (
    <div className="flex h-full flex-col lg:rounded-xl lg:border lg:border-border lg:bg-card/40">
      {/* En-tête du fil */}
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => navigate('/app/messages')}
          aria-label="Retour"
        >
          <ArrowLeft className="size-5" />
        </Button>
        {conversation && (
          <ConversationAvatar
            conv={conversation}
            story={headerStory}
            onClick={
              headerStory ? () => setViewerIndex(headerStory.index) : undefined
            }
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold">
            <span className="truncate">{conversation?.displayName ?? '…'}</span>
            {!conversation?.is_group && (
              <VerifiedBadge
                verified={conversation?.otherMembers?.[0]?.is_verified}
              />
            )}
          </p>
          <p className="font-meta text-xs text-muted-foreground">
            {conversation?.is_group
              ? `${conversation.members?.length ?? 0} membres`
              : `@${conversation?.otherMembers?.[0]?.username ?? ''}`}
          </p>
        </div>
        {conversation && (
          <ConversationMenu conv={conversation} isActive variant="header" />
        )}
      </header>

      {/* Messages */}
      <div ref={threadRef} className="flex-1 space-y-1 overflow-auto px-4 py-4">
        {isLoading ? (
          <MessageThreadSkeleton />
        ) : messages?.length ? (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const next = messages[i + 1]
            const mine = m.sender_id === user?.id
            const newDay =
              !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at))
            const firstOfRun = !prev || prev.sender_id !== m.sender_id || newDay
            const lastOfRun =
              !next ||
              next.sender_id !== m.sender_id ||
              !isSameDay(new Date(next.created_at), new Date(m.created_at))
            const isGroup = conversation?.is_group
            const showName = isGroup && !mine && firstOfRun
            const showAvatar = isGroup && !mine && lastOfRun

            return (
              <Fragment key={m.id}>
                {newDay && <DaySeparator date={m.created_at} />}
                <div
                  className={cn(
                    'msg-row flex items-end gap-2',
                    mine ? 'justify-end' : 'justify-start',
                    firstOfRun ? 'mt-2.5' : 'mt-0.5',
                  )}
                >
                  {/* Gouttière avatar (groupes, messages des autres) */}
                  {isGroup && !mine && (
                    <span className="w-7 shrink-0">
                      {showAvatar && (
                        <UserAvatar profile={m.sender} className="size-7" />
                      )}
                    </span>
                  )}

                  <div className="flex max-w-[78%] flex-col">
                    <div
                      className={cn(
                        'px-3.5 py-2 text-sm shadow-sm',
                        mine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground',
                        // coins : "queue" sur le dernier du groupe
                        mine
                          ? lastOfRun
                            ? 'rounded-2xl rounded-br-sm'
                            : 'rounded-2xl'
                          : lastOfRun
                            ? 'rounded-2xl rounded-bl-sm'
                            : 'rounded-2xl',
                        m._pending && 'opacity-80',
                      )}
                    >
                      {showName && (
                        <p className="mb-0.5 flex items-center gap-1 font-meta text-[11px] font-semibold text-primary">
                          {m.sender?.full_name || `@${m.sender?.username}`}
                          <VerifiedBadge
                            verified={m.sender?.is_verified}
                            className="size-3"
                          />
                        </p>
                      )}
                      {m.status_id && (
                        <p
                          className={cn(
                            'mb-1 rounded-md border-l-2 px-2 py-1 text-xs italic',
                            mine
                              ? 'border-primary-foreground/40 bg-black/10'
                              : 'border-primary/50 bg-background/40',
                          )}
                        >
                          ↩︎ En réponse à {mine ? 'son' : 'ton'} statut
                          {m.repliedStatus?.caption
                            ? ` · « ${m.repliedStatus.caption} »`
                            : ''}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>

                    {/* Méta sous le dernier message d'une série */}
                    {lastOfRun && (
                      <div
                        className={cn(
                          'mt-0.5 flex items-center gap-1 px-1 font-meta text-[10px] text-muted-foreground',
                          mine ? 'justify-end' : 'justify-start',
                        )}
                      >
                        <span>{format(new Date(m.created_at), 'HH:mm')}</span>
                        {mine &&
                          (m._pending ? (
                            <Clock className="size-3" />
                          ) : (
                            <Check className="size-3 text-primary" />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            )
          })
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">Aucun message</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Écris le premier message ci-dessous 👋
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer onSend={onSend} />

      {viewerIndex != null && (
        <StatusViewer
          groups={groups}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}

function DaySeparator({ date }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-secondary px-3 py-0.5 font-meta text-[11px] text-muted-foreground">
        {dayLabel(date)}
      </span>
    </div>
  )
}

function Composer({ onSend }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const taRef = useRef(null)
  const btnRef = useRef(null)

  const autoGrow = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  const reset = () => {
    setText('')
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto'
    })
  }

  const submit = async (e) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    if (!reduced()) {
      gsap.fromTo(
        btnRef.current,
        { scale: 0.8 },
        { scale: 1, duration: 0.45, ease: 'back.out(3)' },
      )
    }
    reset()
    setSending(true)
    try {
      await onSend(body)
    } catch (err) {
      toast.error(friendlyError(err, 'Échec de l’envoi.'))
      setText(body) // restaure la saisie en cas d'échec
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-border p-2.5">
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-background px-2 py-1.5 transition-shadow focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/25">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            autoGrow()
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Écris un message…"
          autoComplete="off"
          className="max-h-[140px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          ref={btnRef}
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Envoyer"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-[transform,opacity] active:scale-95 disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>
    </form>
  )
}

function NewConversationDialog() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('dm') // 'dm' | 'group'
  const [search, setSearch] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [selected, setSelected] = useState([]) // profils sélectionnés (groupe)

  const { data: profiles } = useFriends(search)
  const startDM = useStartDM()
  const createGroup = useCreateGroup()
  const navigate = useNavigate()

  const reset = () => {
    setMode('dm')
    setSearch('')
    setGroupTitle('')
    setSelected([])
  }

  const openDM = async (profile) => {
    try {
      const convId = await startDM.mutateAsync(profile.id)
      setOpen(false)
      reset()
      navigate(`/app/messages/${convId}`)
    } catch (err) {
      toast.error(friendlyError(err, 'Action impossible pour le moment.'))
    }
  }

  const toggleMember = (profile) => {
    setSelected((prev) =>
      prev.find((p) => p.id === profile.id)
        ? prev.filter((p) => p.id !== profile.id)
        : [...prev, profile],
    )
  }

  const submitGroup = async (e) => {
    e.preventDefault()
    if (!groupTitle.trim() || selected.length === 0) return
    try {
      const conv = await createGroup.mutateAsync({
        title: groupTitle,
        memberIds: selected.map((p) => p.id),
      })
      setOpen(false)
      reset()
      navigate(`/app/messages/${conv.id}`)
    } catch (err) {
      toast.error(friendlyError(err, 'Action impossible pour le moment.'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Nouvelle conversation">
          <MessageSquarePlus className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
          <DialogDescription>
            Démarre un message privé ou crée un groupe avec tes amis.
          </DialogDescription>
        </DialogHeader>

        {/* Bascule DM / Groupe */}
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          <button
            onClick={() => setMode('dm')}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
              mode === 'dm' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            Message privé
          </button>
          <button
            onClick={() => setMode('group')}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
              mode === 'group'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            Groupe
          </button>
        </div>

        {mode === 'group' && (
          <div className="space-y-1.5">
            <Label htmlFor="group-title">Nom du groupe</Label>
            <Input
              id="group-title"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Groupe de révision LIC2B"
            />
            {selected.length > 0 && (
              <p className="font-meta text-xs text-muted-foreground">
                {selected.length} sélectionné(s) :{' '}
                {selected.map((p) => '@' + p.username).join(', ')}
              </p>
            )}
          </div>
        )}

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un ami…"
          autoCapitalize="none"
        />

        <div className="max-h-64 space-y-1 overflow-auto">
          {profiles?.length ? (
            profiles.map((p) => {
              const isSel = selected.find((s) => s.id === p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => (mode === 'dm' ? openDM(p) : toggleMember(p))}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent',
                    isSel && 'bg-primary/10',
                  )}
                >
                  <UserAvatar profile={p} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <span className="truncate">
                        {p.full_name || `@${p.username}`}
                      </span>
                      <VerifiedBadge verified={p.is_verified} className="size-3.5" />
                    </p>
                    <p className="truncate font-meta text-xs text-muted-foreground">
                      @{p.username}
                    </p>
                  </div>
                  {mode === 'group' && isSel && (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              )
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search
                ? 'Aucun ami à ce nom.'
                : 'Tu n’as pas encore d’amis. Abonnez-vous mutuellement pour pouvoir discuter.'}
            </p>
          )}
        </div>

        {mode === 'group' && (
          <DialogFooter>
            <Button
              onClick={submitGroup}
              disabled={
                createGroup.isPending ||
                !groupTitle.trim() ||
                selected.length === 0
              }
            >
              {createGroup.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Créer le groupe'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
