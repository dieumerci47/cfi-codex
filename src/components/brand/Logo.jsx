import { cn } from '@/lib/utils'

/**
 * Marque Cirasphère : un "C" gravé dans une pastille, avec un point braise
 * évoquant un nœud de la sphère / un signet.
 */
export function LogoMark({ className }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-8', className)}
      aria-hidden="true"
    >
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="8.5"
        className="fill-card"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      {/* Le "C" ouvert, comme une page tournée */}
      <path
        d="M21.5 10.2A8 8 0 1 0 21.5 21.8"
        stroke="var(--primary)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Signet / point de commit braise */}
      <circle cx="22.4" cy="16" r="2.3" fill="var(--ember)" />
    </svg>
  )
}

/** Logo complet avec le mot-symbole. */
export function Logo({ className, showWordmark = true }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {showWordmark && (
        <span className="font-display text-xl font-semibold tracking-tight">
          Cirasphère
        </span>
      )}
    </span>
  )
}
