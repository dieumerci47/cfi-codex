import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Coche de certification affichée à côté du nom d'un profil vérifié. */
export function VerifiedBadge({ verified, className }) {
  if (!verified) return null
  return (
    <BadgeCheck
      className={cn('inline-block size-4 shrink-0 fill-primary text-background', className)}
      aria-label="Compte certifié"
    />
  )
}
