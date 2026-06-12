import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Révèle son contenu en fondu + glissé quand il entre dans l'écran
 * (IntersectionObserver, une seule fois). Statique sous reduced-motion.
 */
export function RevealItem({ children, y = 24, delay = 0, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    gsap.set(el, { opacity: 0, y })
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            gsap.to(el, {
              opacity: 1,
              y: 0,
              duration: 0.5,
              delay,
              ease: 'power3.out',
            })
            obs.unobserve(el)
          }
        })
      },
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [y, delay])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/**
 * Compteur qui s'anime de 0 jusqu'à `value` (chiffres qui défilent).
 * Statique sous reduced-motion. Réanime à chaque changement de valeur.
 */
export function CountUp({ value = 0, duration = 0.9 }) {
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    const obj = { n: 0 }
    const tween = gsap.to(obj, {
      n: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => setDisplay(Math.round(obj.n)),
    })
    return () => tween.kill()
  }, [value, duration])
  return <>{display}</>
}

/** Petite explosion de particules braise à partir d'un élément (like). */
export function burst(originEl) {
  if (prefersReducedMotion() || !originEl) return
  const rect = originEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const n = 7
  for (let i = 0; i < n; i++) {
    const dot = document.createElement('span')
    dot.className = 'pointer-events-none fixed z-[120] rounded-full bg-ember'
    dot.style.cssText = `left:${cx}px;top:${cy}px;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;`
    document.body.appendChild(dot)
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.6
    const dist = 16 + Math.random() * 22
    gsap.to(dot, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 8,
      opacity: 0,
      scale: 0.3,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => dot.remove(),
    })
  }
}
