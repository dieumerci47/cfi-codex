import { LogoMark } from '@/components/brand/Logo'

/** Écran de chargement plein écran (vérif de session, etc.). */
export function FullScreenLoader({ label = 'Chargement…' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <LogoMark className="size-10 animate-pulse" />
      <p className="font-meta text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
