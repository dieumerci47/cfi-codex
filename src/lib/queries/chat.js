import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Mes conversations, enrichies : autre membre (DM), dernier message, non-lus.
 */
export function useConversations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['conversations', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select(
          '*, members:conversation_members(user_id, last_read_at, user:profiles(id, username, full_name, avatar_url))',
        )
        .order('last_message_at', { ascending: false })
      if (error) throw error
      if (!convs.length) return []

      // Derniers messages de toutes mes conversations (pour aperçu + non-lus)
      const ids = convs.map((c) => c.id)
      const { data: msgs, error: mErr } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
      if (mErr) throw mErr

      const byConv = new Map()
      for (const m of msgs) {
        if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, [])
        byConv.get(m.conversation_id).push(m)
      }

      return convs.map((c) => {
        const mine = c.members.find((m) => m.user_id === user.id)
        const others = c.members.filter((m) => m.user_id !== user.id)
        const list = byConv.get(c.id) ?? []
        const lastMessage = list[0] ?? null
        const lastRead = mine ? new Date(mine.last_read_at) : new Date(0)
        const unread = list.filter(
          (m) => m.sender_id !== user.id && new Date(m.created_at) > lastRead,
        ).length

        return {
          ...c,
          otherMembers: others.map((m) => m.user),
          // nom d'affichage : titre du groupe, ou l'autre membre en DM
          displayName: c.is_group
            ? c.title || 'Groupe'
            : others[0]?.user?.full_name ||
              `@${others[0]?.user?.username ?? 'inconnu'}`,
          lastMessage,
          unread,
        }
      })
    },
  })
}

/** Total des messages non-lus (badge header). */
export function useTotalUnread() {
  const { data } = useConversations()
  return (data ?? []).reduce((sum, c) => sum + c.unread, 0)
}

/** Messages d'une conversation (avec profils expéditeurs). */
export function useMessages(conversationId) {
  return useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(
          '*, sender:profiles(id, username, full_name, avatar_url), ' +
            'repliedStatus:statuses(id, caption, media_path)',
        )
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

/** Détail d'une conversation (membres). */
export function useConversation(conversationId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['conversation', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          '*, members:conversation_members(user_id, user:profiles(id, username, full_name, avatar_url))',
        )
        .eq('id', conversationId)
        .single()
      if (error) throw error
      const others = data.members.filter((m) => m.user_id !== user?.id)
      return {
        ...data,
        otherMembers: others.map((m) => m.user),
        displayName: data.is_group
          ? data.title || 'Groupe'
          : others[0]?.user?.full_name || `@${others[0]?.user?.username ?? ''}`,
      }
    },
  })
}

export function useSendMessage(conversationId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: body.trim(),
        })
        .select('*, sender:profiles(id, username, full_name, avatar_url)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

/** Ouvre (ou crée) un DM avec un utilisateur. Retourne l'id de conversation. */
export function useStartDM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (otherUserId) => {
      const { data, error } = await supabase.rpc('get_or_create_dm', {
        other: otherUserId,
      })
      if (error) throw error
      return data // conversation id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

/** Crée un groupe avec un titre + des membres. */
export function useCreateGroup() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, memberIds }) => {
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ is_group: true, title: title.trim(), created_by: user.id })
        .select()
        .single()
      if (error) throw error

      const rows = [
        { conversation_id: conv.id, user_id: user.id, role: 'admin' },
        ...memberIds.map((id) => ({
          conversation_id: conv.id,
          user_id: id,
          role: 'member',
        })),
      ]
      const { error: mErr } = await supabase
        .from('conversation_members')
        .insert(rows)
      if (mErr) throw mErr
      return conv
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

/** Marque une conversation comme lue (met à jour last_read_at). */
export function useMarkRead() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId) => {
      const { error } = await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

/**
 * Abonnement Realtime global au chat : à chaque nouveau message,
 * rafraîchit la liste des conversations et le fil concerné.
 * Monté une fois dans le shell de l'app.
 */
export function useChatRealtime() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('chat:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const convId = payload.new.conversation_id
          qc.invalidateQueries({ queryKey: ['messages', convId] })
          qc.invalidateQueries({ queryKey: ['conversations'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, qc])
}
