import { UserCheck, UserPlus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useFollowState, useToggleFollow } from '@/lib/queries/social'
import { Button } from '@/components/ui/button'

/** Bouton suivre / abonné (masqué sur son propre profil). */
export function FollowButton({ targetId, size = 'sm' }) {
  const { user } = useAuth()
  const { data: following, isLoading } = useFollowState(targetId)
  const toggle = useToggleFollow()

  if (!user || user.id === targetId) return null

  return (
    <Button
      size={size}
      variant={following ? 'outline' : 'default'}
      disabled={isLoading || toggle.isPending}
      onClick={() => toggle.mutate({ targetId, following })}
    >
      {/* L'état est mis à jour de façon optimiste : on reflète tout de suite
          le résultat plutôt qu'un spinner. */}
      {following ? (
        <>
          <UserCheck className="size-4" /> Abonné
        </>
      ) : (
        <>
          <UserPlus className="size-4" /> Suivre
        </>
      )}
    </Button>
  )
}
