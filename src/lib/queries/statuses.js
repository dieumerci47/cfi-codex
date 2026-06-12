import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const BUCKET = 'status-media'

const mediaUrl = (path) =>
  path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null

/**
 * Statuts actifs visibles, groupés par auteur.
 * Mon groupe en premier ; les autres triés par statut le plus récent,
 * les non-vus avant les vus.
 */
export function useStatusFeed() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['statuses', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: statuses, error } = await supabase
        .from('statuses')
        .select(
          '*, author:profiles!statuses_author_id_fkey(id, username, full_name, avatar_url)',
        )
        .order('created_at', { ascending: true })
      if (error) throw error

      const { data: views } = await supabase
        .from('status_views')
        .select('status_id')
        .eq('viewer_id', user.id)
      const seen = new Set((views ?? []).map((v) => v.status_id))

      const groups = new Map()
      for (const s of statuses) {
        const key = s.author_id
        if (!groups.has(key)) {
          groups.set(key, { author: s.author, statuses: [], allSeen: true })
        }
        const g = groups.get(key)
        g.statuses.push({ ...s, url: mediaUrl(s.media_path), seen: seen.has(s.id) })
        if (!seen.has(s.id) && s.author_id !== user.id) g.allSeen = false
      }

      const list = [...groups.values()]
      const mine = list.find((g) => g.author.id === user.id)
      const others = list
        .filter((g) => g.author.id !== user.id)
        .sort((a, b) => {
          if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1
          const la = a.statuses[a.statuses.length - 1].created_at
          const lb = b.statuses[b.statuses.length - 1].created_at
          return new Date(lb) - new Date(la)
        })
      return { mine: mine ?? null, others }
    },
  })
}

/**
 * Stories actives consultables. Renvoie EXACTEMENT les mêmes groupes ordonnés
 * que la barre de statuts du feed (`[mine, ...others]`) pour que la visionneuse
 * ouverte depuis une photo (feed, profil, messages) se comporte à l'identique :
 * même ordre, même navigation entre les personnes. `storyOf(authorId)` →
 * { index, allSeen } | null indexe dans ce même tableau. Le feed est partagé/
 * caché avec la barre de statuts, donc l'appeler par carte est gratuit.
 */
export function useStories() {
  const { data } = useStatusFeed()
  const groups = useMemo(() => {
    const mine = data?.mine
    const others = data?.others ?? []
    return [...(mine ? [mine] : []), ...others]
  }, [data])
  const indexByAuthor = useMemo(() => {
    const m = new Map()
    groups.forEach((g, i) => m.set(g.author.id, i))
    return m
  }, [groups])
  const storyOf = (authorId) => {
    const i = indexByAuthor.get(authorId)
    return i == null ? null : { index: i, allSeen: groups[i].allSeen }
  }
  return { groups, storyOf }
}

export function useCreateStatus() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, caption, background }) => {
      let media_path = null
      if (file) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_')
        media_path = `${user.id}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(media_path, file, { contentType: file.type })
        if (upErr) throw upErr
      }
      const { data, error } = await supabase
        .from('statuses')
        .insert({
          author_id: user.id,
          media_path,
          caption: caption?.trim() || null,
          background: background || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  })
}

export function useMarkStatusViewed() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (statusId) => {
      const { error } = await supabase
        .from('status_views')
        .upsert(
          { status_id: statusId, viewer_id: user.id },
          { onConflict: 'status_id,viewer_id', ignoreDuplicates: true },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  })
}

/** Spectateurs d'un statut (pour l'auteur). */
export function useStatusViewers(statusId) {
  return useQuery({
    queryKey: ['status-viewers', statusId],
    enabled: !!statusId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_views')
        .select('created_at, viewer:profiles(id, username, full_name, avatar_url)')
        .eq('status_id', statusId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Répondre à un statut → envoie un message dans le DM avec l'auteur. */
export function useReplyToStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ statusId, body }) => {
      const { data, error } = await supabase.rpc('send_status_reply', {
        p_status_id: statusId,
        p_body: body.trim(),
      })
      if (error) throw error
      return data // conversation id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

/** Abonnement Realtime : ajout/suppression de statuts -> rafraîchit la barre. */
export function useStatusesRealtime() {
  const { user } = useAuth()
  const qc = useQueryClient()
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('statuses:feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'statuses' },
        () => qc.invalidateQueries({ queryKey: ['statuses'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, qc])
}

export function useDeleteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (status) => {
      if (status.media_path) {
        await supabase.storage.from(BUCKET).remove([status.media_path])
      }
      const { error } = await supabase.from('statuses').delete().eq('id', status.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  })
}
