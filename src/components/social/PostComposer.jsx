import { useRef, useState } from 'react'
import { FolderTree, ImagePlus, Loader2, Send, X } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
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
  const [focused, setFocused] = useState(false)

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
      setFocused(false)
      toast.success('Publié ✦')
    } catch (err) {
      toast.error(err.message ?? 'Échec de la publication.')
    }
  }

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-2xl border border-border bg-card/60 transition-colors focus-within:border-primary/40 focus-within:bg-card/80"
    >
      <div className="flex gap-3 p-4">
        <UserAvatar profile={profile} className="size-10 shrink-0" />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={focused || body ? 3 : 1}
          placeholder={
            profile?.username
              ? `Quoi de neuf, @${profile.username} ?`
              : 'Quoi de neuf sur le campus ?'
          }
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-0 pt-2 text-[15px] leading-relaxed shadow-none transition-all placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>

      {/* Aperçu des images */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2 px-4 pb-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border"
            >
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 text-foreground backdrop-blur transition-transform active:scale-90"
                aria-label="Retirer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-background/30 px-3 py-2.5">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 active:scale-95"
          aria-label="Ajouter des photos"
        >
          <ImagePlus className="size-5" />
          {files.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-meta text-[10px] font-semibold text-primary-foreground">
              {files.length}
            </span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={addFiles}
        />

        {/* Partage d'un cours */}
        <div className="relative flex items-center">
          <FolderTree className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className={cn(
              'h-9 max-w-44 truncate rounded-full border bg-secondary/60 pl-8 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              collectionId
                ? 'border-primary/40 text-foreground'
                : 'border-border text-muted-foreground',
            )}
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
          size="sm"
          className={cn('ml-auto', canPost && 'glow-primary')}
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
