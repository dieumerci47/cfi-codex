import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'codex-theme'
const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} })

/**
 * Gestion du thème (dark par défaut). Synchronisé avec le script inline
 * de index.html (clé localStorage `codex-theme`) pour éviter le flash.
 */
export function ThemeProvider({ children, defaultTheme = 'dark' }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || defaultTheme,
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    let applied = theme
    if (theme === 'system') {
      applied = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    root.classList.add(applied)
  }, [theme])

  const setTheme = (next) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
