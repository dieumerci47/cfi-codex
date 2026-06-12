import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

/** Envoie un retour (UX / bug / idée) à l'équipe. */
export function useSubmitFeedback() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ category, message }) => {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        category,
        message: message.trim(),
      })
      if (error) throw error
    },
  })
}
