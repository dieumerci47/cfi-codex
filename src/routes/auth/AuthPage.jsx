import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  LogIn,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SCHOOL_DOMAIN = import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN?.trim()

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const signupSchema = z
  .object({
    email: z.string().email('Adresse email invalide'),
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirm: z.string().min(1, 'Confirme ton mot de passe'),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Les mots de passe ne correspondent pas',
  })

const BENEFITS = [
  'Archive tes cours et retrouve-les partout, même dans deux ans',
  'Suis ta promo et partage tes ressources',
  'Discute et révise en groupe',
]

export default function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null) // 'google' | 'apple'

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(isSignup ? signupSchema : loginSchema) })

  // Déjà connecté → vers l'app
  if (!loading && session) return <Navigate to="/app" replace />

  const onSubmit = async (values) => {
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

  const signInWith = async (provider) => {
    setOauthLoading(provider)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/app` },
      })
      if (error) throw error
      // Redirection gérée par Supabase ; en cas d'échec on retombe ici.
    } catch (err) {
      toast.error(
        err.message?.includes('not enabled')
          ? `Connexion ${provider} pas encore activée côté serveur.`
          : (err.message ?? 'Connexion impossible.'),
      )
      setOauthLoading(null)
    }
  }

  const forgotPassword = async () => {
    const email = getValues('email')
    if (!email) {
      toast.error('Saisis ton email d’abord, puis réessaie.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) toast.error(error.message)
    else toast.success('Si un compte existe, un email de réinitialisation a été envoyé.')
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Panneau de marque (caché sur mobile) — contenu distinct selon le mode */}
      <aside
        className={cn(
          'relative hidden flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex',
          isSignup ? 'bg-card' : 'bg-card',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: isSignup
              ? 'radial-gradient(40rem 30rem at 80% 10%, color-mix(in srgb, var(--ember) 18%, transparent), transparent 60%), radial-gradient(30rem 24rem at 10% 90%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%)'
              : 'radial-gradient(40rem 30rem at 20% 10%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 60%), radial-gradient(30rem 24rem at 90% 90%, color-mix(in srgb, var(--ember) 10%, transparent), transparent 60%)',
          }}
        />
        <Logo />

        {isSignup ? (
          <div className="relative max-w-md">
            <h2 className="font-display text-3xl leading-tight">
              Rejoins le Codex de ton école.
            </h2>
            <ul className="mt-6 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ember/15 text-ember">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="relative max-w-md">
            <blockquote className="font-display text-3xl leading-tight">
              « Le cours que tu sauves aujourd’hui, tu le retrouveras dans deux
              ans. »
            </blockquote>
            <p className="mt-4 font-meta text-sm text-muted-foreground">
              — la promesse Codex
            </p>
          </div>
        )}

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

          {/* Chip distinctif : couleur + libellé différents selon le mode */}
          <span
            className={cn(
              'mt-6 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-meta text-xs font-medium lg:mt-0',
              isSignup
                ? 'bg-ember/15 text-ember'
                : 'bg-primary/15 text-primary',
            )}
          >
            {isSignup ? (
              <>
                <Sparkles className="size-3.5" /> Inscription
              </>
            ) : (
              <>
                <LogIn className="size-3.5" /> Connexion
              </>
            )}
          </span>

          <h1 className="mt-3 text-3xl font-semibold">
            {isSignup ? 'Crée ton compte' : 'Content de te revoir'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? 'Quelques secondes, et ta promo te retrouve sur Codex.'
              : 'Connecte-toi pour retrouver tes cours et ta promo.'}
          </p>

          {/* Connexion sociale */}
          <div className="mt-7">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!!oauthLoading}
              onClick={() => signInWith('google')}
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GoogleIcon className="size-4" />
              )}
              {isSignup ? 'S’inscrire' : 'Continuer'} avec Google
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-meta text-xs text-muted-foreground">
              ou avec ton email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={forgotPassword}
                    className="font-meta text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmation du mot de passe — uniquement à l'inscription */}
            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('confirm')}
                  aria-invalid={!!errors.confirm}
                />
                {errors.confirm && (
                  <p className="text-xs text-destructive">{errors.confirm.message}</p>
                )}
              </div>
            )}

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
              {isSignup ? 'Se connecter' : 'Créer un compte'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

