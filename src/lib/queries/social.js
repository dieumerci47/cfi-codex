import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const POST_MEDIA_BUCKET = 'post-media'

const POST_SELECT =
  '*, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url), ' +
  'collection:collections(id, title, visibility), ' +
  'media:post_media(id, storage_path), likes(user_id), comments(count)'

/** Met en forme une ligne post : compteurs + liked_by_me + URLs média. */
function shapePost(row, myId) {
  const likes = row.likes ?? []
  return {
    ...row,
    like_count: likes.length,
    liked_by_me: likes.some((l) => l.user_id === myId),
    comment_count: row.comments?.[0]?.count ?? 0,
    media: (row.media ?? []).map((m) => ({
      ...m,
      url: supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(m.storage_path)
        .data.publicUrl,
    })),
  }
}

/** Feed : posts des personnes suivies + soi. Repli sur toute l'école si on ne suit personne. */
export function useFeed() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['feed', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: follows, error: fErr } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      if (fErr) throw fErr

      let query = supabase
        .from('posts')
        .select(POST_SELECT)
        .order('created_at', { ascending: false })
        .limit(50)

      if (follows.length > 0) {
        const ids = [...follows.map((f) => f.following_id), user.id]
        query = query.in('author_id', ids)
      }

      const { data, error } = await query
      if (error) throw error
      return data.map((r) => shapePost(r, user.id))
    },
  })
}

/** Posts d'un utilisateur donné. */
export function useUserPosts(userId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['user-posts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map((r) => shapePost(r, user?.id))
    },
  })
}

export function useCreatePost() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, files = [], collection_id }) => {
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          body: body?.trim() || null,
          collection_id: collection_id || null,
        })
        .select()
        .single()
      if (error) throw error

      for (const file of files) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_')
        const path = `${user.id}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage
          .from(POST_MEDIA_BUCKET)
          .upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        const { error: mErr } = await supabase
          .from('post_media')
          .insert({ post_id: post.id, storage_path: path, kind: 'image' })
        if (mErr) throw mErr
      }
      return post
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['user-posts'] })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['user-posts'] })
    },
  })
}

export function useToggleLike() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, liked }) => {
      if (liked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['user-posts'] })
    },
  })
}

export function useComments(postId) {
  return useQuery({
    queryKey: ['comments', postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(username, full_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useAddComment(postId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, author_id: user.id, body: body.trim() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['user-posts'] })
    },
  })
}

// ---- FOLLOW ----------------------------------------------------
export function useFollowState(targetId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['follow-state', user?.id, targetId],
    enabled: !!user?.id && !!targetId && user.id !== targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })
}

export function useFollowCounts(userId) {
  return useQuery({
    queryKey: ['follow-counts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),
      ])
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      }
    },
  })
}

export function useToggleFollow() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ targetId, following }) => {
      if (following) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: targetId })
        if (error) throw error
      }
    },
    onSuccess: (_d, { targetId }) => {
      qc.invalidateQueries({ queryKey: ['follow-state', user?.id, targetId] })
      qc.invalidateQueries({ queryKey: ['follow-counts', targetId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['is-friend'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}

/** Amis = abonnement mutuel. Utilisé pour démarrer une conversation. */
export function useFriends(search = '') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['friends', user?.id, search],
    enabled: !!user?.id,
    queryFn: async () => {
      const [following, followers] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('follows').select('follower_id').eq('following_id', user.id),
      ])
      if (following.error) throw following.error
      if (followers.error) throw followers.error

      const followingSet = new Set(following.data.map((f) => f.following_id))
      const friendIds = followers.data
        .map((f) => f.follower_id)
        .filter((id) => followingSet.has(id))
      if (friendIds.length === 0) return []

      let query = supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, promo')
        .in('id', friendIds)
      if (search.trim()) {
        query = query.or(
          `username.ilike.%${search}%,full_name.ilike.%${search}%`,
        )
      }
      const { data, error } = await query.order('full_name')
      if (error) throw error
      return data
    },
  })
}

/** Suis-je ami (abonnement mutuel) avec cet utilisateur ? */
export function useIsFriend(targetId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['is-friend', user?.id, targetId],
    enabled: !!user?.id && !!targetId && user.id !== targetId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('are_friends', {
        a: user.id,
        b: targetId,
      })
      if (error) throw error
      return data === true
    },
  })
}

/** Découverte : profils de l'école (hors soi), les plus récents. */
export function useDiscoverProfiles(search = '') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['discover', user?.id, search],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, promo, bio')
        .not('username', 'is', null)
        .neq('id', user.id)
        .limit(30)
      if (search.trim()) {
        query = query.or(
          `username.ilike.%${search}%,full_name.ilike.%${search}%`,
        )
      }
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}
