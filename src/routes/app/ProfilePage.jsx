import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Camera,
  Check,
  FolderTree,
  Globe,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/utils'
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
import { useStories } from '@/lib/queries/statuses'
import { CountUp, prefersReducedMotion } from '@/components/motion'
import { UserAvatar } from '@/components/social/UserAvatar'
import { VerifiedBadge } from '@/components/social/VerifiedBadge'
import { StatusViewer } from '@/components/social/StatusBar'
import { FollowButton } from '@/components/social/FollowButton'
import { PostCard } from '@/components/social/PostCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  const { data: counts, isLoading: countsLoading } = useFollowCounts(profile.id)
  const { data: collections } = useCollections(profile.id)
  const { data: posts, isLoading: postsLoading } = useUserPosts(profile.id)
  const { data: isFriend } = useIsFriend(profile.id)
  const { groups, storyOf } = useStories()
  const startDM = useStartDM()
  const update = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const [storyIndex, setStoryIndex] = useState(null)
  const scope = useRef(null)

  // Édition en ligne (pas de popup) : on bascule les champs en place.
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [promo, setPromo] = useState(profile.promo ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null)
  const [preview, setPreview] = useState(null) // aperçu local avant upload
  const busy = update.isPending || uploadAvatar.isPending

  // Story de la personne (cachée en édition et sur mon propre profil)
  const story = self || editing ? null : storyOf(profile.id)

  const startEdit = () => {
    setFullName(profile.full_name ?? '')
    setPromo(profile.promo ?? '')
    setBio(profile.bio ?? '')
    setAvatarUrl(profile.avatar_url ?? null)
    setPreview(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setPreview(null)
  }

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

  const saveEdit = async () => {
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
      setEditing(false)
      setPreview(null)
    } catch (err) {
      toast.error(err.message ?? 'Erreur.')
    }
  }

  // Entrée orchestrée : bannière, avatar qui éclôt, identité, stats, onglets.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('[data-pf="banner"]', { opacity: 0, duration: 0.5 })
        .from(
          '[data-pf="avatar"]',
          { scale: 0.5, opacity: 0, duration: 0.55, ease: 'back.out(1.7)' },
          '-=0.25',
        )
        .from(
          '[data-pf="action"]',
          { x: 12, opacity: 0, duration: 0.4 },
          '-=0.35',
        )
        .from(
          '[data-pf="reveal"]',
          { y: 16, opacity: 0, duration: 0.45, stagger: 0.08 },
          '-=0.2',
        )
    },
    { scope },
  )

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
    <div ref={scope} className="mx-auto w-full max-w-2xl pb-6">
      {/* Bannière éditoriale */}
      <div
        data-pf="banner"
        className="relative h-36 overflow-hidden border-b border-border/60 sm:h-44"
      >
        <div className="absolute inset-0 bg-linear-to-tr from-primary/25 via-background to-ember/20" />
        <div className="absolute -left-10 bottom-[-60%] size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-[-40%] size-56 rounded-full bg-ember/15 blur-3xl" />
      </div>

      <div className="px-4 sm:px-6">
        {/* Avatar superposé + actions */}
        <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          {editing ? (
            <span data-pf="avatar" className="block shrink-0">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Changer la photo de profil"
                className="group relative block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserAvatar
                  profile={{ ...profile, avatar_url: preview || avatarUrl }}
                  className="size-24 rounded-2xl ring-4 ring-background sm:size-28"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white">
                  {uploadAvatar.isPending ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : (
                    <Camera className="size-6" />
                  )}
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickAvatar}
              />
            </span>
          ) : story ? (
            <button
              type="button"
              data-pf="avatar"
              onClick={() => setStoryIndex(story.index)}
              aria-label={`Voir la story de ${profile.full_name || profile.username}`}
              className={cn(
                'block shrink-0 rounded-[1.4rem] p-1 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring',
                story.allSeen
                  ? 'bg-border'
                  : 'bg-linear-to-tr from-primary to-ember',
              )}
            >
              <UserAvatar
                profile={profile}
                className="size-24 rounded-2xl ring-4 ring-background sm:size-28"
              />
            </button>
          ) : (
            <span data-pf="avatar" className="block shrink-0">
              <UserAvatar
                profile={profile}
                className="size-24 rounded-2xl ring-4 ring-background sm:size-28"
              />
            </span>
          )}
          <div data-pf="action" className="mb-1 flex items-center gap-2">
            {self ? (
              editing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={busy}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    disabled={busy || !fullName.trim()}
                  >
                    {update.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="size-4" /> Enregistrer
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="size-4" /> Modifier le profil
                </Button>
              )
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

        {/* Identité — bascule en champs éditables en place */}
        <div data-pf="reveal" className="mt-3">
          {editing ? (
            <div className="space-y-3">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={60}
                placeholder="Ton nom complet"
                aria-label="Nom complet"
                className="w-full rounded-none border-0 border-b border-border bg-transparent pb-1 font-display text-2xl font-semibold leading-tight outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <p className="font-meta text-sm text-muted-foreground">
                @{profile.username}{' '}
                <span className="text-muted-foreground/70">
                  (pseudo non modifiable)
                </span>
              </p>
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                maxLength={40}
                placeholder="Promo / filière (optionnel)"
                aria-label="Promo ou filière"
                className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary"
              />
              <div>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={160}
                  placeholder="Ce que tu étudies, ce que tu partages…"
                  aria-label="Bio"
                />
                <p className="mt-1 text-right font-meta text-xs text-muted-foreground">
                  {bio.length}/160
                </p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="flex items-center gap-1.5 font-display text-2xl font-semibold leading-tight">
                {profile.full_name || `@${profile.username}`}
                <VerifiedBadge verified={profile.is_verified} className="size-5" />
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
                <p className="mt-3 max-w-prose text-sm leading-relaxed">
                  {profile.bio}
                </p>
              )}
            </>
          )}
        </div>

        {/* Statistiques */}
        <div
          data-pf="reveal"
          className="mt-4 grid grid-cols-3 divide-x divide-border/60 rounded-xl border border-border/60 bg-card/40 py-3 text-center"
        >
          <Stat
            value={counts?.followers ?? 0}
            label="abonnés"
            loading={countsLoading && counts == null}
          />
          <Stat
            value={counts?.following ?? 0}
            label="abonnements"
            loading={countsLoading && counts == null}
          />
          <Stat
            value={posts?.length ?? 0}
            label="posts"
            loading={postsLoading && posts == null}
          />
        </div>

        {/* Onglets */}
        <Tabs data-pf="reveal" defaultValue="collections" className="mt-6">
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
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/20 active:translate-y-0"
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors group-hover:bg-primary/20">
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

      {storyIndex != null && (
        <StatusViewer
          groups={groups}
          startIndex={storyIndex}
          onClose={() => setStoryIndex(null)}
        />
      )}
    </div>
  )
}

function Stat({ value, label, loading }) {
  return (
    <div className="px-2">
      {loading ? (
        <div className="mx-auto h-5 w-8 animate-pulse rounded bg-muted" />
      ) : (
        <p className="font-display text-lg font-semibold tabular-nums leading-none">
          <CountUp value={value} />
        </p>
      )}
      <p className="mt-1 font-meta text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function EmptyTab({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
