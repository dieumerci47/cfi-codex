import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Download, Loader2, FileWarning } from 'lucide-react'
import { getSignedUrl } from '@/lib/queries/collections'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** Affiche une ressource (note markdown, image, PDF) dans une modale. */
export function ResourceViewer({ resource, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="flex items-center gap-2 font-meta text-sm">
            {resource?.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Aperçu de la ressource {resource?.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(90dvh-3.5rem)] overflow-auto">
          {resource && <ResourceBody resource={resource} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResourceBody({ resource }) {
  if (resource.kind === 'note') {
    return (
      <article className="prose-codex px-6 py-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {resource.note_content || '*(note vide)*'}
        </ReactMarkdown>
      </article>
    )
  }
  return <FileBody resource={resource} />
}

function FileBody({ resource }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setUrl(null)
    setError(false)
    getSignedUrl(resource.storage_path)
      .then((u) => active && setUrl(u))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [resource.storage_path])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-muted-foreground">
        <FileWarning className="size-8" />
        <p>Impossible de charger ce fichier.</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex justify-center px-6 py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const mime = resource.mime_type || ''

  if (mime.startsWith('image/')) {
    return (
      <div className="flex justify-center bg-black/20 p-4">
        <img
          src={url}
          alt={resource.name}
          className="max-h-[75dvh] rounded-lg object-contain"
        />
      </div>
    )
  }

  if (mime === 'application/pdf') {
    return (
      <iframe
        title={resource.name}
        src={url}
        className="h-[75dvh] w-full bg-white"
      />
    )
  }

  // Type non prévisualisable → téléchargement
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        Aperçu indisponible pour ce type de fichier.
      </p>
      <Button asChild>
        <a href={url} target="_blank" rel="noreferrer" download={resource.name}>
          <Download className="size-4" /> Télécharger
        </a>
      </Button>
    </div>
  )
}
