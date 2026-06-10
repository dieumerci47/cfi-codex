import { useRef, useState } from 'react'
import { FolderTree, ImagePlus, Loader2, Send, X } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth/AuthProvider'
import { useCreatePost } from '@/lib/queries/social'
import { useCollections } from '@/lib/queries/collections'
import { useMyProfile } from '@/lib/queries/profile'
import { UserAvatar } from '@/components/social/UserAvatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function PostComposer() {
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const { data: collections } = useCollections(user?.id)
  const create = useCreatePost()
  const fileInput = useRef(null)

  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [collectionId, setCollectionId] = useState('')

  const canPost = body.trim() || files.length > 0 || collectionId

  const addFiles = (e) => {
    const picked = Array.from(e.target.files ?? []).slice(0, 4)
    setFiles((prev) => [...prev, ...picked].slice(0, 4))
    e.target.value = ''
  }

  const removeFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx))

  const submit = async (e) => {
    e.preventDefault()
    if (!canPost) return
    try {
      await create.mutateAsync({ body, files, collection_id: collectionId })
      setBody('')
      setFiles([])
      setCollectionId('')
      toast.success('Publié ✦')
    } catch (err) {
      toast.error(err.message ?? 'Échec de la publication.')
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card/60 p-4"
    >
      <div className="flex gap-3">
        <UserAvatar profile={profile} />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Quoi de neuf sur le campus ?"
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Aperçu images */}
      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 pl-12">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 backdrop-blur"
                aria-label="Retirer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 pl-12">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInput.current?.click()}
          aria-label="Ajouter des photos"
        >
          <ImagePlus className="size-5 text-primary" />
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={addFiles}
        />

        {/* Partage de collection */}
        <div className="relative flex items-center">
          <FolderTree className="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Partager un cours…</option>
            {collections?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          className="ml-auto"
          disabled={!canPost || create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Send className="size-4" /> Publier
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
