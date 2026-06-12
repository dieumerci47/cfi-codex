import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

/** Supprime définitivement le compte de l'utilisateur (cascade côté DB + stockage). */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
    },
  })
}

/** Profil de l'utilisateur connecté. `username === null` => onboarding requis. */
export function useMyProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Profil public par username. */
export function useProfileByUsername(username) {
  return useQuery({
    queryKey: ['profile', 'by-username', username],
    enabled: !!username,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Vérifie la disponibilité d'un username (true = libre). */
export async function isUsernameAvailable(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return !data
}

/** Téléverse un avatar (bucket public `avatars`) et renvoie son URL publique. */
export function useUploadAvatar() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (file) => {
      const safe = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${user.id}/${Date.now()}-${safe}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    },
  })
}

/** Met à jour le profil de l'utilisateur connecté. */
export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['profile', user?.id], data)
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
