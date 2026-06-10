import { UserCheck, UserPlus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useMyFollowing, useToggleFollow } from '@/lib/queries/social'
import { Button } from '@/components/ui/button'

/** Bouton suivre / abonné (masqué sur son propre profil). */
export function FollowButton({ targetId, size = 'sm' }) {
  const { user } = useAuth()
  const { data: followingSet, isPending } = useMyFollowing()
  const toggle = useToggleFollow()

  if (!user || user.id === targetId) return null

  // Tant que la liste « qui je suis » n'est pas chargée, on n'affiche pas
  // « Suivre » par défaut (ce serait trompeur) : état neutre désactivé.
  if (isPending) {
    return (
      <Button size={size} variant="outline" disabled className="opacity-60">
        …
      </Button>
    )
  }

  const following = followingSet?.has(targetId) ?? false

  return (
    <Button
      size={size}
      variant={following ? 'outline' : 'default'}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ targetId, following })}
    >
      {/* État mis à jour de façon optimiste : reflète tout de suite le résultat. */}
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
