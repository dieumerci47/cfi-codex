import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'

/** Bascule clair / sombre. */
export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme !== 'light'

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}
