import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const POST_MEDIA_BUCKET = 'post-media'

// Compteurs lus depuis les colonnes dénormalisées (plus d'agrégation à la lecture).
const POST_SELECT =
  '*, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url, is_verified), ' +
  'collection:collections(id, title, visibility), ' +
  'media:post_media(id, storage_path)'

const FEED_RECENT_LIMIT = 25
const FEED_CHRONO_LIMIT = 15
const FEED_WINDOW_MS = 72 * 60 * 60 * 1000 // frontière récent/chrono : 72 h

/** Met en forme une ligne post : URLs média + liked_by_me (via un Set). */
function shapePost(row, likedSet) {
  return {
    ...row,
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    liked_by_me: likedSet?.has(row.id) ?? false,
    media: (row.media ?? []).map((m) => ({
      ...m,
      url: supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(m.storage_path)
        .data.publicUrl,
    })),
  }
}

/** Hydrate une liste d'IDs (dans l'ordre) → posts complets + liked_by_me. */
async function hydratePosts(ids, myId) {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .in('id', ids)
  if (error) throw error
  let likedSet = new Set()
  if (myId) {
    const { data: myLikes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', myId)
      .in('post_id', ids)
    likedSet = new Set((myLikes ?? []).map((l) => l.post_id))
  }
  const byId = new Map(data.map((p) => [p.id, p]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => shapePost(row, likedSet))
}

/** Applique `fn` à chaque post — cache plat (tableau) OU paginé (infinite query). */
function mapPosts(data, fn) {
  if (!data) return data
  if (Array.isArray(data)) return data.map(fn)
  if (data.pages) {
    return {
      ...data,
      pages: data.pages.map((pg) =>
        pg && Array.isArray(pg.posts) ? { ...pg, posts: pg.posts.map(fn) } : pg,
      ),
    }
  }
  return data
}

/**
 * Feed hybride : 1re page = fenêtre récente (<72 h) classée par score (RPC),
 * pages suivantes = chronologique keyset au-delà de 72 h. Pas de chevauchement.
 */
export function useFeed() {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: ['feed', user?.id],
    enabled: !!user?.id,
    initialPageParam: { mode: 'recent' },
    queryFn: async ({ pageParam }) => {
      if (pageParam.mode === 'recent') {
        const { data, error } = await supabase.rpc('feed_recent_ranked', {
          p_limit: FEED_RECENT_LIMIT,
        })
        if (error) throw error
        const posts = await hydratePosts(
          (data ?? []).map((r) => r.post_id),
          user.id,
        )
        return {
          posts,
          nextParam: {
            mode: 'chrono',
            before: new Date(Date.now() - FEED_WINDOW_MS).toISOString(),
          },
        }
      }
      const { data, error } = await supabase.rpc('feed_chrono', {
        p_before: pageParam.before,
        p_limit: FEED_CHRONO_LIMIT,
      })
      if (error) throw error
      const rows = data ?? []
      const posts = await hydratePosts(
        rows.map((r) => r.post_id),
        user.id,
      )
      const last = rows[rows.length - 1]
      return {
        posts,
        nextParam:
          rows.length < FEED_CHRONO_LIMIT
            ? undefined
            : { mode: 'chrono', before: last.created_at },
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextParam,
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
      const ids = data.map((p) => p.id)
      let likedSet = new Set()
      if (user?.id && ids.length) {
        const { data: myLikes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', ids)
        likedSet = new Set((myLikes ?? []).map((l) => l.post_id))
      }
      return data.map((row) => shapePost(row, likedSet))
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
    // Mise à jour optimiste : on patche le cache tout de suite, sans recharger
    // le feed. Le compteur ±1 est exact, donc pas de refetch nécessaire.
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: ['feed'] })
      await qc.cancelQueries({ queryKey: ['user-posts'] })
      const patchOne = (p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !liked,
              like_count: Math.max(0, p.like_count + (liked ? -1 : 1)),
            }
          : p
      const prev = [
        ...qc.getQueriesData({ queryKey: ['feed'] }),
        ...qc.getQueriesData({ queryKey: ['user-posts'] }),
      ]
      qc.setQueriesData({ queryKey: ['feed'] }, (d) => mapPosts(d, patchOne))
      qc.setQueriesData({ queryKey: ['user-posts'] }, (d) => mapPosts(d, patchOne))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
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
        .select('*, author:profiles(id, username, full_name, avatar_url, is_verified)')
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
    // Optimiste : on affiche le commentaire et on incrémente le compteur tout
    // de suite, sans recharger le feed.
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['comments', postId] })
      const me = qc.getQueryData(['profile', user.id])
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        post_id: postId,
        author_id: user.id,
        body: body.trim(),
        created_at: new Date().toISOString(),
        author: {
          id: user.id,
          username: me?.username ?? 'moi',
          full_name: me?.full_name ?? null,
          avatar_url: me?.avatar_url ?? null,
          is_verified: me?.is_verified ?? false,
        },
        _optimistic: true,
      }
      const prevComments = qc.getQueryData(['comments', postId])
      qc.setQueryData(['comments', postId], (old) => [...(old ?? []), optimistic])

      const bumpOne = (p) =>
        p.id === postId
          ? { ...p, comment_count: (p.comment_count ?? 0) + 1 }
          : p
      const prev = [
        ...qc.getQueriesData({ queryKey: ['feed'] }),
        ...qc.getQueriesData({ queryKey: ['user-posts'] }),
      ]
      qc.setQueriesData({ queryKey: ['feed'] }, (d) => mapPosts(d, bumpOne))
      qc.setQueriesData({ queryKey: ['user-posts'] }, (d) => mapPosts(d, bumpOne))
      return { prevComments, prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevComments !== undefined)
        qc.setQueryData(['comments', postId], ctx.prevComments)
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    // Resynchronise le vrai commentaire (id + horodatage serveur).
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', postId] }),
  })
}

/** Supprime un commentaire (optimiste : retire + décrémente le compteur). */
export function useDeleteComment(postId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ['comments', postId] })
      const prevComments = qc.getQueryData(['comments', postId])
      qc.setQueryData(['comments', postId], (old) =>
        (old ?? []).filter((c) => c.id !== commentId),
      )
      const decOne = (p) =>
        p.id === postId
          ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) - 1) }
          : p
      const prev = [
        ...qc.getQueriesData({ queryKey: ['feed'] }),
        ...qc.getQueriesData({ queryKey: ['user-posts'] }),
      ]
      qc.setQueriesData({ queryKey: ['feed'] }, (d) => mapPosts(d, decOne))
      qc.setQueriesData({ queryKey: ['user-posts'] }, (d) => mapPosts(d, decOne))
      return { prevComments, prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevComments !== undefined)
        qc.setQueryData(['comments', postId], ctx.prevComments)
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', postId] }),
  })
}

// ---- FOLLOW ----------------------------------------------------
/**
 * Ensemble des IDs que je suis — une seule requête partagée par tous les
 * boutons « Suivre » (Explore, profils, feed). Mise en cache globalement, donc
 * l'état est exact dès le 1er rendu sur les pages revisitées (plus de flash
 * « Suivre » → « Abonné »).
 */
export function useMyFollowing() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-following', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      if (error) throw error
      return new Set(data.map((f) => f.following_id))
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
    // Optimiste sur l'ensemble « qui je suis » + le compteur d'abonnés.
    onMutate: async ({ targetId, following }) => {
      const followingKey = ['my-following', user?.id]
      const countsKey = ['follow-counts', targetId]
      await qc.cancelQueries({ queryKey: followingKey })
      await qc.cancelQueries({ queryKey: countsKey })
      const prevFollowing = qc.getQueryData(followingKey)
      const prevCounts = qc.getQueryData(countsKey)
      if (prevFollowing) {
        const next = new Set(prevFollowing)
        if (following) next.delete(targetId)
        else next.add(targetId)
        qc.setQueryData(followingKey, next)
      }
      if (prevCounts) {
        qc.setQueryData(countsKey, {
          ...prevCounts,
          followers: Math.max(0, prevCounts.followers + (following ? -1 : 1)),
        })
      }
      return { followingKey, countsKey, prevFollowing, prevCounts }
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return
      if (ctx.prevFollowing) qc.setQueryData(ctx.followingKey, ctx.prevFollowing)
      if (ctx.prevCounts) qc.setQueryData(ctx.countsKey, ctx.prevCounts)
    },
    // Réconciliation en arrière-plan des données dérivées côté serveur
    // (amitié = abonnement mutuel, feed des suivis). Non bloquant.
    onSettled: (_d, _e, { targetId }) => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['is-friend'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['follow-counts', targetId] })
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
        .select('id, username, full_name, avatar_url, promo, is_verified')
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
        .select('id, username, full_name, avatar_url, promo, bio, is_verified')
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

/** Suggestions de personnes à suivre (promo + amis communs + populaire). */
export function useSuggestedPeople() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['suggest-people', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('suggest_people', {
        p_limit: 20,
      })
      if (error) throw error
      return data
    },
  })
}

/** Recherche de personnes (trigram + ilike), classée par similarité. */
export function useSearchPeople(q) {
  const { user } = useAuth()
  const term = q.trim()
  return useQuery({
    queryKey: ['search-people', user?.id, term],
    enabled: !!user?.id && term.length >= 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_people', {
        p_q: term,
        p_limit: 20,
      })
      if (error) throw error
      return data
    },
  })
}
