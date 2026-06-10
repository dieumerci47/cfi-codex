import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth/AuthProvider'
import {
  useMyProfile,
  useUpdateProfile,
  isUsernameAvailable,
} from '@/lib/queries/profile'
import { Logo } from '@/components/brand/Logo'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  username: z
    .string()
    .min(3, '3 caractères minimum')
    .max(20, '20 caractères maximum')
    .regex(/^[a-z0-9_]+$/, 'Lettres minuscules, chiffres et _ uniquement'),
  full_name: z.string().min(1, 'Indique ton nom').max(60),
  promo: z.string().max(40).optional().or(z.literal('')),
  bio: z.string().max(160).optional().or(z.literal('')),
})

export default function OnboardingPage() {
  const { loading: authLoading } = useAuth()
  const { data: profile, isLoading } = useMyProfile()
  const updateProfile = useUpdateProfile()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  if (authLoading || isLoading) return <FullScreenLoader />

  // Profil déjà complété → on file vers l'app
  if (profile?.username) return <Navigate to="/app" replace />

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      const available = await isUsernameAvailable(values.username)
      if (!available) {
        toast.error('Ce pseudo est déjà pris.')
        setSubmitting(false)
        return
      }
      await updateProfile.mutateAsync({
        username: values.username,
        full_name: values.full_name,
        promo: values.promo || null,
        bio: values.bio || null,
      })
      toast.success('Bienvenue dans le Codex ✦')
      navigate('/app')
    } catch (err) {
      toast.error(err.message ?? 'Une erreur est survenue.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-10">
      <Logo />

      <div className="mt-10 w-full max-w-md">
        <p className="font-meta text-xs text-primary">étape finale</p>
        <h1 className="mt-2 text-3xl font-semibold">Crée ton profil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          C’est ainsi que ta promo te reconnaîtra sur Codex.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Pseudo</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-transparent pl-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="font-meta text-sm text-muted-foreground">@</span>
              <Input
                id="username"
                className="border-0 px-0 shadow-none focus-visible:ring-0"
                placeholder="ada_lovelace"
                autoCapitalize="none"
                {...register('username')}
                aria-invalid={!!errors.username}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nom complet</Label>
            <Input
              id="full_name"
              placeholder="Ada Lovelace"
              {...register('full_name')}
              aria-invalid={!!errors.full_name}
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo">
              Promo / filière{' '}
              <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              id="promo"
              placeholder="L2 Informatique · 2025"
              {...register('promo')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">
              Bio <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Textarea
              id="bio"
              rows={2}
              placeholder="Ce que tu étudies, ce que tu partages…"
              {...register('bio')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Entrer dans le Codex <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
