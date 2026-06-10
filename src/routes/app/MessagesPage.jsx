import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  MessageSquarePlus,
  Send,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useMarkRead,
  useStartDM,
  useCreateGroup,
} from '@/lib/queries/chat'
import { useFriends } from '@/lib/queries/social'
import {
  ConversationListSkeleton,
  MessageThreadSkeleton,
} from '@/components/skeletons'
import { UserAvatar } from '@/components/social/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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
            <ChatThread conversationId={id} />
          ) : (
            <div className="hidden h-full items-center justify-center rounded-xl border border-border bg-card/40 lg:flex">
              <p className="text-sm text-muted-foreground">
                Sélectionne une conversation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConversationList({ activeId }) {
  const { data: conversations, isLoading } = useConversations()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col lg:rounded-xl lg:border lg:border-border lg:bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Messages</h1>
        <NewConversationDialog />
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations?.length ? (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/app/messages/${c.id}`)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/60',
                activeId === c.id && 'bg-accent',
              )}
            >
              <ConversationAvatar conv={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.displayName}</span>
                  {c.lastMessage && (
                    <span className="shrink-0 font-meta text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.lastMessage.created_at), {
                        addSuffix: false,
                        locale: fr,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">
                    {c.lastMessage?.body ?? 'Nouvelle conversation'}
                  </span>
                  {c.unread > 0 && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ember font-meta text-[10px] font-semibold text-ember-foreground">
                      {c.unread > 9 ? '9+' : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aucune conversation. Démarre une discussion avec le bouton
            ci-dessus, ou depuis le profil d’un élève.
          </div>
        )}
      </div>
    </div>
  )
}

function ConversationAvatar({ conv }) {
  if (conv.is_group) {
    return (
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
        <Users className="size-5" />
      </span>
    )
  }
  return <UserAvatar profile={conv.otherMembers[0]} className="size-10" />
}

function ChatThread({ conversationId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: conversation } = useConversation(conversationId)
  const { data: messages, isLoading } = useMessages(conversationId)
  const send = useSendMessage(conversationId)
  const markRead = useMarkRead()

  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  // Auto-scroll en bas + marquage "lu" quand les messages changent
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages?.length) markRead.mutate(conversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, conversationId])

  const submit = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      await send.mutateAsync(body)
    } catch (err) {
      toast.error(err.message ?? 'Échec de l’envoi.')
      setText(body)
    }
  }

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
        {conversation && <ConversationAvatar conv={conversation} />}
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {conversation?.displayName ?? '…'}
          </p>
          {conversation?.is_group && (
            <p className="font-meta text-xs text-muted-foreground">
              {conversation.members?.length} membres
            </p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-auto px-4 py-4">
        {isLoading ? (
          <MessageThreadSkeleton />
        ) : (
          messages?.map((m, i) => {
            const mine = m.sender_id === user?.id
            const showName =
              conversation?.is_group &&
              !mine &&
              messages[i - 1]?.sender_id !== m.sender_id
            return (
              <div
                key={m.id}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm',
                    mine
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-secondary text-secondary-foreground',
                  )}
                >
                  {showName && (
                    <p className="mb-0.5 font-meta text-[11px] opacity-70">
                      @{m.sender?.username}
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
                      {m.repliedStatus?.caption ? ` · « ${m.repliedStatus.caption} »` : ''}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Saisie */}
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-border px-3 py-2.5"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris un message…"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || send.isPending}>
          {send.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
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
      toast.error(err.message ?? 'Erreur.')
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
      toast.error(err.message ?? 'Erreur.')
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
                  onClick={() =>
                    mode === 'dm' ? openDM(p) : toggleMember(p)
                  }
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent',
                    isSel && 'bg-primary/10',
                  )}
                >
                  <UserAvatar profile={p} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.full_name || `@${p.username}`}
                    </p>
                    <p className="truncate font-meta text-xs text-muted-foreground">
                      @{p.username}
                    </p>
                  </div>
                  {mode === 'group' && isSel && (
                    <span className="font-meta text-xs text-primary">✓</span>
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
