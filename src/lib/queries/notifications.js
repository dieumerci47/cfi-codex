import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

/** Mes notifications (avec acteur + contexte). */
export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          '*, actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url), ' +
            'collection:collections(id, title)',
        )
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      return data
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/** Abonnement Realtime : nouvelle notif -> rafraîchit la cloche. */
export function useNotificationsRealtime() {
  const { user } = useAuth()
  const qc = useQueryClient()

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
        () => qc.invalidateQueries({ queryKey: ['notifications'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, qc])
}
