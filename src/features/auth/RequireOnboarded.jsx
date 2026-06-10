import { Navigate } from 'react-router-dom'
import { useMyProfile } from '@/lib/queries/profile'
import { FullScreenLoader } from '@/components/FullScreenLoader'

/**
 * À utiliser dans les routes privées : si le profil n'a pas de username,
 * l'utilisateur n'a pas terminé l'onboarding → on l'y envoie.
 */
export function RequireOnboarded({ children }) {
  const { data: profile, isLoading } = useMyProfile()

  if (isLoading) return <FullScreenLoader />
  if (!profile?.username) return <Navigate to="/onboarding" replace />

  return children
}
