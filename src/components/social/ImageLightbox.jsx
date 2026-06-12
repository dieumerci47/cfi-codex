import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/** Visionneuse plein écran des images d'un post. */
export function ImageLightbox({ images, startIndex = 0, onClose }) {
  const [i, setI] = useState(startIndex)
  const has = images?.length > 0
  const multi = images?.length > 1

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((p) => (p + 1) % images.length)
      if (e.key === 'ArrowLeft') setI((p) => (p - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images, onClose])

  if (!has) return null

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        aria-label="Fermer"
      >
        <X className="size-6" />
      </button>

      {multi && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setI((p) => (p - 1 + images.length) % images.length)
          }}
          className="absolute left-3 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Précédent"
        >
          <ChevronLeft className="size-7" />
        </button>
      )}

      <img
        src={images[i].url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] max-w-full rounded-lg object-contain"
      />

      {multi && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setI((p) => (p + 1) % images.length)
          }}
          className="absolute right-3 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Suivant"
        >
          <ChevronRight className="size-7" />
        </button>
      )}

      {multi && (
        <div className="absolute bottom-5 flex gap-1.5">
          {images.map((_, idx) => (
            <span
              key={idx}
              className={`size-1.5 rounded-full ${idx === i ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
