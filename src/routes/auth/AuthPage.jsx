import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SCHOOL_DOMAIN = import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN?.trim()

const schema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
})

export default function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  // Déjà connecté → vers l'app
  if (!loading && session) return <Navigate to="/app" replace />

  const onSubmit = async (values) => {
    // Restriction mono-école (si un domaine est configuré)
    if (SCHOOL_DOMAIN && !values.email.toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`)) {
      toast.error(`Seules les adresses @${SCHOOL_DOMAIN} sont autorisées.`)
      return
    }

    setSubmitting(true)
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        })
        if (error) throw error
        toast.success('Compte créé ! Vérifie tes emails pour confirmer.')
        navigate('/login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })
        if (error) throw error
        navigate('/app')
      }
    } catch (err) {
      toast.error(err.message ?? 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Panneau de marque (caché sur mobile) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(40rem 30rem at 20% 10%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%), radial-gradient(30rem 24rem at 90% 90%, color-mix(in srgb, var(--ember) 12%, transparent), transparent 60%)',
          }}
        />
        <Logo />
        <div className="relative max-w-md">
          <blockquote className="font-display text-3xl leading-tight">
            « Le cours que tu sauves aujourd’hui, tu le retrouveras dans deux
            ans. »
          </blockquote>
          <p className="mt-4 font-meta text-sm text-muted-foreground">
            — la promesse Codex
          </p>
        </div>
        <p className="relative font-meta text-xs text-muted-foreground">
          archive · partage · progresse
        </p>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/">
              <ArrowLeft className="size-4" /> Accueil
            </Link>
          </Button>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-6 text-3xl font-semibold lg:mt-0">
            {isSignup ? 'Rejoindre Codex' : 'Bon retour'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? 'Crée ton compte avec ton adresse de l’école.'
              : 'Connecte-toi pour retrouver tes cours.'}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email de l’école</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={SCHOOL_DOMAIN ? `prenom@${SCHOOL_DOMAIN}` : 'prenom@ecole.fr'}
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {isSignup ? 'Créer mon compte' : 'Se connecter'}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignup ? 'Se connecter' : 'Rejoindre'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
