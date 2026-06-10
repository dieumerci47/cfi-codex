import { Link, useNavigate, useParams } from 'react-router-dom'
import { FolderTree, Globe, Loader2, Lock, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth/AuthProvider'
import { useMyProfile, useProfileByUsername } from '@/lib/queries/profile'
import { useCollections } from '@/lib/queries/collections'
import { useUserPosts, useFollowCounts } from '@/lib/queries/social'
import { useStartDM } from '@/lib/queries/chat'
import { UserAvatar } from '@/components/social/UserAvatar'
import { FollowButton } from '@/components/social/FollowButton'
import { PostCard } from '@/components/social/PostCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
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
  const { data: counts } = useFollowCounts(profile.id)
  const { data: collections } = useCollections(profile.id)
  const { data: posts } = useUserPosts(profile.id)
  const startDM = useStartDM()
  const navigate = useNavigate()

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
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      {/* En-tête profil */}
      <div className="flex items-start gap-4">
        <UserAvatar profile={profile} className="size-20" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {profile.full_name || `@${profile.username}`}
              </h1>
              <p className="font-meta text-sm text-muted-foreground">
                @{profile.username}
                {profile.promo && ` · ${profile.promo}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!self && (
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
            </div>
          </div>

          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}

          <div className="mt-3 flex gap-4 font-meta text-sm">
            <span>
              <strong>{counts?.followers ?? 0}</strong>{' '}
              <span className="text-muted-foreground">abonnés</span>
            </span>
            <span>
              <strong>{counts?.following ?? 0}</strong>{' '}
              <span className="text-muted-foreground">abonnements</span>
            </span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="collections" className="mt-6">
        <TabsList>
          <TabsTrigger value="collections">
            Cours ({visibleCollections?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="posts">
            Posts ({posts?.length ?? 0})
          </TabsTrigger>
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
  )
}

function EmptyTab({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
