import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Compass,
  Home,
  LogOut,
  Plus,
  FolderTree,
  MessageCircle,
  User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { useMyProfile } from '@/lib/queries/profile'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatRealtime, useTotalUnread } from '@/lib/queries/chat'
import { useNotificationsRealtime } from '@/lib/queries/notifications'
import { useStatusesRealtime } from '@/lib/queries/statuses'
import { useMyFollowing } from '@/lib/queries/social'
import { NotificationsBell } from '@/components/social/NotificationsBell'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'

const NAV = [
  { to: '/app', label: 'Feed', icon: Home, end: true },
  { to: '/app/explore', label: 'Explorer', icon: Compass },
  { to: '/app/collections', label: 'Cours', icon: FolderTree },
  { to: '/app/me', label: 'Profil', icon: UserIcon },
]

export default function AppLayout() {
  useChatRealtime() // abonnement live au chat (badge + fils)
  useNotificationsRealtime() // abonnement live aux notifications (cloche)
  useStatusesRealtime() // abonnement live aux statuts (ajout/suppression)
  useMyFollowing() // préchauffe « qui je suis » → boutons Suivre sans flash

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card/40 px-4 py-5 lg:flex">
        <Logo />

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}

          <Button asChild className="mt-4 justify-start gap-2 glow-primary">
            <Link to="/app/collections">
              <Plus className="size-4" /> Nouvelle collection
            </Link>
          </Button>
        </nav>

        <SidebarProfile />
      </aside>

      {/* Colonne principale */}
      <div className="flex min-h-dvh flex-col">
        {/* Barre du haut (toutes tailles) — accès Messages en haut à droite */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur">
          {/* Gauche : nom (mobile) + bascule de thème */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 lg:hidden">
              <LogoMark className="size-7" />
              <span className="font-display text-lg font-semibold">Cirasphère</span>
            </span>
            <ThemeToggle />
          </div>
          {/* Droite : notifications, messages, menu profil */}
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <MessagesButton />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 pb-24 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <BottomLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}

/** Menu compte (header) : cercle avatar → nom, email, profil, déconnexion. */
function ProfileMenu() {
  const { user, signOut } = useAuth()
  const { data: profile } = useMyProfile()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-1 rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Mon compte"
      >
        <UserAvatar profile={profile} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar profile={profile} className="size-10" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-medium">
              {profile?.full_name || profile?.username || 'Mon compte'}
              <VerifiedBadge verified={profile?.is_verified} />
            </p>
            <p className="truncate font-meta text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/me">
            <UserIcon className="size-4" /> Mon profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="size-4" /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Mini-carte profil en bas de la sidebar desktop (avatar + nom + email). */
function SidebarProfile() {
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  return (
    <Link
      to="/app/me"
      className="flex items-center gap-3 rounded-lg border-t border-border px-1 pt-4 transition-colors hover:text-primary"
    >
      <UserAvatar profile={profile} className="size-9" />
      <div className="min-w-0">
        <p className="flex items-center gap-1 truncate text-sm font-medium">
          {profile?.full_name || profile?.username || 'Mon compte'}
          <VerifiedBadge verified={profile?.is_verified} />
        </p>
        <p className="truncate font-meta text-xs text-muted-foreground">
          {user?.email}
        </p>
      </div>
    </Link>
  )
}

function MessagesButton() {
  const unread = useTotalUnread()
  return (
    <NavLink
      to="/app/messages"
      className={({ isActive }) =>
        cn(
          'relative inline-flex size-9 items-center justify-center rounded-md transition-colors',
          isActive
            ? 'bg-primary/12 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
      aria-label="Messages"
    >
      <MessageCircle className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-ember px-1 font-meta text-[10px] font-semibold text-ember-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  )
}

function SideLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/12 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  )
}

function BottomLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-16 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  )
}
