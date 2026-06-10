import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Camera,
  FolderTree,
  Globe,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth/AuthProvider'
import {
  useMyProfile,
  useProfileByUsername,
  useUpdateProfile,
  useUploadAvatar,
} from '@/lib/queries/profile'
import { useCollections } from '@/lib/queries/collections'
import { useUserPosts, useFollowCounts, useIsFriend } from '@/lib/queries/social'
import { useStartDM } from '@/lib/queries/chat'
import { UserAvatar } from '@/components/social/UserAvatar'
import { FollowButton } from '@/components/social/FollowButton'
import { PostCard } from '@/components/social/PostCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileSkeleton } from '@/components/skeletons'

export default function ProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const myProfile = useMyProfile()
  const otherProfile = useProfileByUsername(username)

  // /app/me => mon profil ; /app/u/:username => profil ciblé
  const isMe = !username
  const profile = isMe ? myProfile.data : otherProfile.data
  const isLoading = isMe ? myProfile.isLoading : otherProfile.isLoading

  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (!profile) {
    return (
      <div className="px-4 py-20 text-center text-muted-foreground">
        Profil introuvable.
      </div>
    )
  }

  return <ProfileView profile={profile} self={profile.id === user?.id} />
}

function ProfileView({ profile, self }) {
  const { data: counts, isPending: countsLoading } = useFollowCounts(profile.id)
  const { data: collections } = useCollections(profile.id)
  const { data: posts } = useUserPosts(profile.id)
  const { data: isFriend } = useIsFriend(profile.id)
  const startDM = useStartDM()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const onMessage = async () => {
    try {
      const convId = await startDM.mutateAsync(profile.id)
      navigate(`/app/messages/${convId}`)
    } catch (err) {
      toast.error(err.message ?? 'Impossible d’ouvrir la conversation.')
    }
  }

  // Sur le profil d'un autre, on ne montre que les collections publiques
  const visibleCollections = self
    ? collections
    : collections?.filter((c) => c.visibility === 'public')

  return (
    <div className="mx-auto w-full max-w-2xl pb-6">
      {/* Bannière éditoriale */}
      <div className="relative h-36 overflow-hidden border-b border-border/60 sm:h-44">
        <div className="absolute inset-0 bg-linear-to-tr from-primary/25 via-background to-ember/20" />
        <div className="absolute -left-10 bottom-[-60%] size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-[-40%] size-56 rounded-full bg-ember/15 blur-3xl" />
      </div>

      <div className="px-4 sm:px-6">
        {/* Avatar superposé + actions */}
        <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          <UserAvatar
            profile={profile}
            className="size-24 rounded-2xl ring-4 ring-background sm:size-28"
          />
          <div className="mb-1 flex items-center gap-2">
            {self ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Modifier le profil
              </Button>
            ) : (
              <>
                {isFriend && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onMessage}
                    disabled={startDM.isPending}
                  >
                    {startDM.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageCircle className="size-4" />
                    )}
                    Message
                  </Button>
                )}
                <FollowButton targetId={profile.id} />
              </>
            )}
          </div>
        </div>

        {/* Identité */}
        <div className="mt-3">
          <h1 className="font-display text-2xl font-semibold leading-tight">
            {profile.full_name || `@${profile.username}`}
          </h1>
          <p className="font-meta text-sm text-muted-foreground">
            @{profile.username}
            {profile.promo && (
              <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                {profile.promo}
              </span>
            )}
          </p>

          {profile.bio && (
            <p className="mt-3 max-w-prose text-sm leading-relaxed">{profile.bio}</p>
          )}

          <div className="mt-4 flex gap-5 font-meta text-sm">
            <span>
              <CountValue value={counts?.followers} loading={countsLoading} />{' '}
              <span className="text-muted-foreground">abonnés</span>
            </span>
            <span>
              <CountValue value={counts?.following} loading={countsLoading} />{' '}
              <span className="text-muted-foreground">abonnements</span>
            </span>
          </div>
        </div>

        {/* Onglets */}
        <Tabs defaultValue="collections" className="mt-6">
          <TabsList>
            <TabsTrigger value="collections">
              Cours ({visibleCollections?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="posts">Posts ({posts?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="collections" className="mt-4">
            {visibleCollections?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleCollections.map((c) => (
                  <Link
                    key={c.id}
                    to={`/app/collections/${c.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40"
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <FolderTree className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium group-hover:text-primary">
                        {c.title}
                      </p>
                      <p className="font-meta text-xs text-muted-foreground">
                        {c.visibility === 'private' ? (
                          <Lock className="inline size-3" />
                        ) : (
                          <Globe className="inline size-3" />
                        )}{' '}
                        {c.subject?.code ?? 'cours'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyTab label="Aucun cours public pour l’instant." />
            )}
          </TabsContent>

          <TabsContent value="posts" className="mt-4 space-y-4">
            {posts?.length ? (
              posts.map((p) => <PostCard key={p.id} post={p} />)
            ) : (
              <EmptyTab label="Aucun post pour l’instant." />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {self && (
        <EditProfileDialog
          profile={profile}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

function EditProfileDialog({ profile, open, onClose }) {
  const update = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const fileInput = useRef(null)

  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [promo, setPromo] = useState(profile.promo ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null)
  const [preview, setPreview] = useState(null) // URL locale avant upload

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreview(URL.createObjectURL(file))
    try {
      const url = await uploadAvatar.mutateAsync(file)
      setAvatarUrl(url)
    } catch (err) {
      toast.error(err.message ?? 'Échec du téléversement de l’avatar.')
      setPreview(null)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Indique ton nom.')
      return
    }
    try {
      await update.mutateAsync({
        full_name: fullName.trim(),
        promo: promo.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      })
      toast.success('Profil mis à jour ✦')
      onClose()
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier mon profil</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="group relative shrink-0 rounded-2xl"
              aria-label="Changer l’avatar"
            >
              <UserAvatar
                profile={{ ...profile, avatar_url: preview || avatarUrl }}
                className="size-20 rounded-2xl"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {uploadAvatar.isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Camera className="size-5" />
                )}
              </span>
            </button>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Photo de profil</p>
              <p className="font-meta text-xs">JPG ou PNG. Clique pour changer.</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickAvatar}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Pseudo</Label>
            <Input value={`@${profile.username}`} disabled />
            <p className="font-meta text-xs text-muted-foreground">
              Le pseudo n’est pas modifiable.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Nom complet</Label>
            <Input
              id="ep-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-promo">
              Promo / filière{' '}
              <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              id="ep-promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="L2 Informatique · 2025"
              maxLength={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-bio">
              Bio <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Textarea
              id="ep-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder="Ce que tu étudies, ce que tu partages…"
            />
            <p className="text-right font-meta text-xs text-muted-foreground">
              {bio.length}/160
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={update.isPending || uploadAvatar.isPending || !fullName.trim()}
            >
              {update.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CountValue({ value, loading }) {
  if (loading && value == null) {
    return (
      <span className="inline-block h-4 w-5 animate-pulse rounded bg-muted align-middle" />
    )
  }
  return <strong className="text-base">{value ?? 0}</strong>
}

function EmptyTab({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
