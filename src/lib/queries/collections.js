import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const RESOURCES_BUCKET = 'resources'

/** Liste des matières (référence). */
export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

/** Collections d'un utilisateur (par défaut : le compte connecté). */
export function useCollections(ownerId) {
  const { user } = useAuth()
  const target = ownerId ?? user?.id
  return useQuery({
    queryKey: ['collections', target],
    enabled: !!target,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*, subject:subjects(name, code)')
        .eq('owner_id', target)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Détail d'une collection (avec étoiles). */
export function useCollection(id) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['collection', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(
          '*, subject:subjects(name, code), owner:profiles!collections_owner_id_fkey(username, full_name, avatar_url), stars:collection_stars(user_id)',
        )
        .eq('id', id)
        .single()
      if (error) throw error
      const stars = data.stars ?? []
      return {
        ...data,
        star_count: stars.length,
        starred_by_me: stars.some((s) => s.user_id === user?.id),
      }
    },
  })
}

/** Toutes les ressources d'une collection (arbre construit côté client). */
export function useResources(collectionId) {
  return useQuery({
    queryKey: ['resources', collectionId],
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('collection_id', collectionId)
        .order('kind', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

/** Collections (à moi / membre) avec des modifications non consultées → Map(id → nombre). */
export function useCollectionsUnseen() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['collections-unseen', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_collections_unseen')
      if (error) throw error
      const map = new Map()
      for (const row of data) map.set(row.collection_id, Number(row.unseen_count))
      return map
    },
  })
}

/** Mes ressources « déjà vues » dans une collection → Map(resource_id → seen_at). */
export function useResourceSeen(collectionId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['resource-seen', collectionId, user?.id],
    enabled: !!collectionId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resource_seen')
        .select('resource_id, seen_at, resources!inner(collection_id)')
        .eq('user_id', user.id)
        .eq('resources.collection_id', collectionId)
      if (error) throw error
      const map = new Map()
      for (const row of data) map.set(row.resource_id, row.seen_at)
      return map
    },
  })
}

/** Marque une liste de ressources comme vues (upsert seen_at = maintenant). */
export function useMarkResourcesSeen(collectionId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (resourceIds) => {
      const ids = [...new Set(resourceIds)].filter(Boolean)
      if (ids.length === 0) return
      const now = new Date().toISOString()
      const rows = ids.map((resource_id) => ({
        user_id: user.id,
        resource_id,
        seen_at: now,
      }))
      const { error } = await supabase
        .from('resource_seen')
        .upsert(rows, { onConflict: 'user_id,resource_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource-seen', collectionId, user?.id] })
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
      qc.invalidateQueries({ queryKey: ['collections-unseen', user?.id] })
    },
  })
}

export function useCreateCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, description, subject_id, visibility }) => {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          owner_id: user.id,
          title,
          description: description || null,
          subject_id: subject_id || null,
          visibility: visibility || 'public',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { data, error } = await supabase
        .from('collections')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      qc.invalidateQueries({ queryKey: ['collection', data.id] })
    },
  })
}

export function useDeleteCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('collections').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  })
}

// ---- MEMBRES (collaboration & abonnement) --------------------

/** Mon appartenance à une collection (ligne collection_members ou null). */
export function useMyMembership(collectionId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['collection-membership', collectionId, user?.id],
    enabled: !!collectionId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_members')
        .select('role, created_at')
        .eq('collection_id', collectionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data // { role, created_at } | null
    },
  })
}

/** Liste des membres d'une collection (avec profils). */
export function useCollectionMembers(collectionId) {
  return useQuery({
    queryKey: ['collection-members', collectionId],
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_members')
        .select('role, created_at, user:profiles(id, username, full_name, avatar_url)')
        .eq('collection_id', collectionId)
        .order('role')
      if (error) throw error
      return data
    },
  })
}

/** Invite un membre par pseudo (rôle editor ou follower). Propriétaire uniquement. */
export function useInviteMember(collectionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ username, role }) => {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username.replace(/^@/, '').trim())
        .maybeSingle()
      if (pErr) throw pErr
      if (!prof) throw new Error('Aucun élève avec ce pseudo.')

      const { error } = await supabase
        .from('collection_members')
        .upsert(
          { collection_id: collectionId, user_id: prof.id, role },
          { onConflict: 'collection_id,user_id' },
        )
      if (error) throw error
      return prof
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-members', collectionId] })
    },
  })
}

export function useRemoveMember(collectionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId) => {
      const { error } = await supabase
        .from('collection_members')
        .delete()
        .eq('collection_id', collectionId)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-members', collectionId] })
      qc.invalidateQueries({ queryKey: ['collection-membership', collectionId] })
    },
  })
}

/** S'abonner / se désabonner d'une collection (rôle follower). */
export function useToggleCollectionFollow(collectionId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (isFollowing) => {
      if (isFollowing) {
        const { error } = await supabase
          .from('collection_members')
          .delete()
          .eq('collection_id', collectionId)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('collection_members')
          .insert({ collection_id: collectionId, user_id: user.id, role: 'follower' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-membership', collectionId] })
      qc.invalidateQueries({ queryKey: ['collection-members', collectionId] })
      qc.invalidateQueries({ queryKey: ['my-collections'] })
    },
  })
}

/** Collections où je suis membre d'un rôle donné ('editor' | 'follower'). */
export function useMemberCollections(role) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-collections', role, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_members')
        .select(
          'collection:collections(*, subject:subjects(name, code), owner:profiles!collections_owner_id_fkey(username, full_name, avatar_url))',
        )
        .eq('user_id', user.id)
        .eq('role', role)
      if (error) throw error
      return data.map((r) => r.collection).filter(Boolean)
    },
  })
}

/** Étoiler / désétoiler un cours (optimiste). */
export function useToggleStar(collectionId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (starred) => {
      if (starred) {
        const { error } = await supabase
          .from('collection_stars')
          .delete()
          .eq('collection_id', collectionId)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('collection_stars')
          .insert({ collection_id: collectionId, user_id: user.id })
        if (error) throw error
      }
    },
    onMutate: async (starred) => {
      const key = ['collection', collectionId]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      if (prev) {
        qc.setQueryData(key, {
          ...prev,
          starred_by_me: !starred,
          star_count: Math.max(0, (prev.star_count ?? 0) + (starred ? -1 : 1)),
        })
      }
      return { key, prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['popular-collections'] }),
  })
}

/** Cours publics les plus étoilés (page Explorer, onglet Cours). */
export function usePopularCollections() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['popular-collections'],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(
          '*, subject:subjects(name, code), owner:profiles!collections_owner_id_fkey(username, full_name, avatar_url), stars:collection_stars(user_id)',
        )
        .eq('visibility', 'public')
        .limit(30)
      if (error) throw error
      return data
        .map((c) => ({ ...c, star_count: c.stars?.length ?? 0 }))
        .sort((a, b) => b.star_count - a.star_count)
    },
  })
}

/** Crée un dossier ou une note (pas d'upload de fichier). */
export function useCreateResource(collectionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ kind, name, parent_id, note_content }) => {
      const { data, error } = await supabase
        .from('resources')
        .insert({
          collection_id: collectionId,
          parent_id: parent_id || null,
          kind,
          name,
          note_content: note_content ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources', collectionId] })
      qc.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}

/** Upload d'un fichier vers le bucket privé + enregistrement de la ressource. */
export function useUploadFile(collectionId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, parent_id }) => {
      // Chemin : <user_id>/<collection_id>/<timestamp>-<nom>
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${user.id}/${collectionId}/${Date.now()}-${safeName}`

      const { error: upErr } = await supabase.storage
        .from(RESOURCES_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr

      const { data, error } = await supabase
        .from('resources')
        .insert({
          collection_id: collectionId,
          parent_id: parent_id || null,
          kind: 'file',
          name: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources', collectionId] })
      qc.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}

/** Upload de plusieurs fichiers d'un coup (invalide une seule fois). */
export function useUploadFiles(collectionId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ files, parent_id }) => {
      const results = []
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, '_')
        const path = `${user.id}/${collectionId}/${Date.now()}-${safeName}`

        const { error: upErr } = await supabase.storage
          .from(RESOURCES_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type })
        if (upErr) throw upErr

        const { data, error } = await supabase
          .from('resources')
          .insert({
            collection_id: collectionId,
            parent_id: parent_id || null,
            kind: 'file',
            name: file.name,
            storage_path: path,
            mime_type: file.type,
            size_bytes: file.size,
          })
          .select()
          .single()
        if (error) throw error
        results.push(data)
      }
      return results
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources', collectionId] })
      qc.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}

/**
 * Importe un dossier complet en recréant son arborescence.
 * `files` = FileList dont chaque entrée porte un `webkitRelativePath`
 * (« Dossier/sous-dossier/fichier.pdf »). Les dossiers manquants sont créés
 * une seule fois, puis chaque fichier est rangé dans le bon dossier.
 */
export function useUploadFolder(collectionId) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ files, parent_id }) => {
      const list = Array.from(files ?? [])
      // Cache chemin-relatif -> id de dossier (la racine = le dossier courant)
      const folderIds = new Map([['', parent_id || null]])

      // Crée le dossier (et ses parents) si besoin, de façon mémoïsée.
      const ensureFolder = async (dirPath) => {
        if (folderIds.has(dirPath)) return folderIds.get(dirPath)
        const idx = dirPath.lastIndexOf('/')
        const parentPath = idx === -1 ? '' : dirPath.slice(0, idx)
        const name = idx === -1 ? dirPath : dirPath.slice(idx + 1)
        const parentResourceId = await ensureFolder(parentPath)
        const { data, error } = await supabase
          .from('resources')
          .insert({
            collection_id: collectionId,
            parent_id: parentResourceId,
            kind: 'folder',
            name,
          })
          .select()
          .single()
        if (error) throw error
        folderIds.set(dirPath, data.id)
        return data.id
      }

      let count = 0
      for (const file of list) {
        const rel = file._relPath || file.webkitRelativePath || file.name
        const parts = rel.split('/')
        const fileName = parts.pop()
        const folderId = await ensureFolder(parts.join('/'))

        const safeName = fileName.replace(/[^\w.\-]+/g, '_')
        const rand = Math.random().toString(36).slice(2, 7)
        const path = `${user.id}/${collectionId}/${Date.now()}-${rand}-${safeName}`

        const { error: upErr } = await supabase.storage
          .from(RESOURCES_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type })
        if (upErr) throw upErr

        const { error } = await supabase.from('resources').insert({
          collection_id: collectionId,
          parent_id: folderId,
          kind: 'file',
          name: fileName,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        })
        if (error) throw error
        count++
      }
      return { files: count, folders: folderIds.size - 1 }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources', collectionId] })
      qc.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}

/** Renomme une ressource (dossier, fichier ou note). */
export function useRenameResource(collectionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }) => {
      const { data, error } = await supabase
        .from('resources')
        .update({ name })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources', collectionId] }),
  })
}

export function useDeleteResource(collectionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (resource) => {
      if (resource.storage_path) {
        await supabase.storage.from(RESOURCES_BUCKET).remove([resource.storage_path])
      }
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', resource.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources', collectionId] }),
  })
}

/**
 * Recherche plein-texte dans les cours (titres/descriptions de collections,
 * noms de fichiers, contenu des notes). La visibilité est gérée par la RLS.
 */
export function useSearchCourses(query) {
  const { user } = useAuth()
  const q = query.trim()
  return useQuery({
    queryKey: ['search-courses', q],
    enabled: !!user?.id && q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_courses', { q })
      if (error) throw error
      return data
    },
  })
}

/** URL signée temporaire pour lire un fichier du bucket privé. */
export async function getSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}
