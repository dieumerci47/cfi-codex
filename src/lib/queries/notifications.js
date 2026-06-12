import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { pushNotifToast } from '@/components/social/pushToasts'

const NOTIF_SELECT =
  '*, actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url, is_verified), ' +
  'collection:collections(id, title), ' +
  'resource:resources(id, name, kind, parent_id)'

/** Destination d'une notification (même logique que la cloche). */
export function notifDest(n) {
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

/** Mes notifications (avec acteur + contexte). */
export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIF_SELECT)
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      return data
    },
  })
}

/** Marque une seule notification comme lue (optimiste). */
export function useMarkNotifRead() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications', user?.id] })
      const prev = qc.getQueryData(['notifications', user?.id])
      qc.setQueryData(['notifications', user?.id], (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', user?.id], ctx.prev)
    },
  })
}

/** Nombre de notifications non lues (badge cloche). */
export function useUnreadNotifCount() {
  const { data } = useNotifications()
  return (data ?? []).filter((n) => !n.read).length
}

/** Marque toutes mes notifications comme lues. */
export function useMarkNotifsRead() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (error) throw error
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications', user?.id] })
      const prev = qc.getQueryData(['notifications', user?.id])
      qc.setQueryData(['notifications', user?.id], (old) =>
        (old ?? []).map((n) => (n.read ? n : { ...n, read: true })),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', user?.id], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  })
}

/** Abonnement Realtime : nouvelle notif -> rafraîchit la cloche. */
export function useNotificationsRealtime() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('notifications:' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          qc.invalidateQueries({ queryKey: ['notifications'] })
          // une modif de collection peut être arrivée → rafraîchit les repères
          qc.invalidateQueries({ queryKey: ['collections-unseen', user.id] })
          qc.invalidateQueries({ queryKey: ['resources'] })
          qc.invalidateQueries({ queryKey: ['resource-seen'] })

          // Toast « push » avec l'acteur et le contexte
          const { data: n } = await supabase
            .from('notifications')
            .select(NOTIF_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (!n) return
          let detail
          if (n.type === 'collection_change') {
            detail = [n.resource?.name, n.collection?.title]
              .filter(Boolean)
              .join(' · ')
          } else if (n.type === 'collection_invite') {
            detail = n.collection?.title
          }
          pushNotifToast({
            type: n.type,
            actor: n.actor,
            detail,
            onClick: () => navigate(notifDest(n)),
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, qc, navigate])
}
