import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function initials(profile) {
  const base = profile?.full_name || profile?.username || '?'
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

/** Avatar d'un profil avec repli initiales. */
export function UserAvatar({ profile, className }) {
  return (
    <Avatar className={cn('size-9', className)}>
      {profile?.avatar_url && (
        <AvatarImage src={profile.avatar_url} alt={profile.username} />
      )}
      <AvatarFallback className="bg-primary/15 font-meta text-xs text-primary">
        {initials(profile)}
      </AvatarFallback>
    </Avatar>
  )
}
