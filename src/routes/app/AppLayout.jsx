import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Compass,
  Home,
  LogOut,
  Plus,
  FolderTree,
  User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const NAV = [
  { to: '/app', label: 'Feed', icon: Home, end: true },
  { to: '/app/explore', label: 'Explorer', icon: Compass },
  { to: '/app/collections', label: 'Cours', icon: FolderTree },
  { to: '/app/me', label: 'Profil', icon: UserIcon },
]

export default function AppLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

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

        <div className="flex items-center justify-between border-t border-border pt-4">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" /> Quitter
          </Button>
        </div>
      </aside>

      {/* Colonne principale */}
      <div className="flex min-h-dvh flex-col">
        {/* Barre du haut (mobile) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <LogoMark />
          <span className="font-display text-lg font-semibold">Codex</span>
          <ThemeToggle />
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
