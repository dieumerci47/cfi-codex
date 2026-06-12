import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  // Flame,
  FolderTree,
  GitBranch,
  Heart,
  MessagesSquare,
  Radio,
  // Search,
  ShieldCheck,
  Star,
  // Video,
} from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Halo d'ambiance émeraude + braise, façon lueur de page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 80% -10%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 60%), radial-gradient(40rem 30rem at 0% 10%, color-mix(in srgb, var(--ember) 10%, transparent), transparent 55%)',
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Hero />
        <FeatureGrid />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Logo />
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/login">Se connecter</Link>
        </Button>
        <Button asChild>
          <Link to="/signup">
            Rejoindre <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-meta text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-primary" />
          la communauté du savoir · CFI-CIRAS
        </span>

        <h1 className="mt-6 text-balance text-5xl leading-[0.98] font-semibold sm:text-6xl lg:text-7xl">
          Ton savoir,{' '}
          <span className="italic text-primary">gardé à vie.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Cirasphère, c’est le{' '}
          <span className="font-medium text-foreground">GitHub de tes cours</span>{' '}
          mêlé au meilleur du réseau social. Archive tes notes et tes PDF,
          <span className="font-medium text-foreground">
            {' '}
            retrouve-les en un mot-clé
          </span>
          , suis ta promo et partage ce que tu apprends.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="glow-primary">
            <Link to="/signup">
              Créer mon compte <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">J’ai déjà un compte</Link>
          </Button>
        </div>

        <p className="mt-5 inline-flex items-center gap-2 font-meta text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          réservé aux membres de l’école · tes cours t’appartiennent
        </p>
      </div>

      <CourseCard />
    </section>
  )
}

/** Carte décorative : une "collection" de cours façon repo. */
function CourseCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-3 -z-10 rounded-3xl bg-linear-to-br from-primary/10 to-ember/10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 edge-hairline">
        {/* Barre de titre type éditeur */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 font-meta text-xs text-muted-foreground">
            <FolderTree className="size-4 text-primary" />
            algo-&-structures
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
              public
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 font-meta text-xs text-ember">
            <Star className="size-3.5" /> 14
          </span>
        </div>

        {/* Arborescence */}
        <ul className="space-y-1 p-4 font-meta text-sm">
          <TreeRow depth={0} icon={<GitBranch className="size-4 text-primary" />}>
            cours-algo/
          </TreeRow>
          <TreeRow depth={1}>complexite.pdf</TreeRow>
          <TreeRow depth={1}>tri-fusion.md</TreeRow>
          <TreeRow depth={1}>td-03-graphes.pdf</TreeRow>
          <TreeRow depth={0} icon={<GitBranch className="size-4 text-primary" />}>
            reseaux/
          </TreeRow>
          <TreeRow depth={1}>modele-osi.png</TreeRow>
        </ul>

        {/* Pied : signaux sociaux */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-3 font-meta text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-3.5 text-ember" /> 32
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck className="size-3.5 fill-primary text-background" /> certifié
          </span>
          <span className="ml-auto">maj. il y a 2 h</span>
        </div>
      </div>
    </div>
  )
}

function TreeRow({ depth = 0, icon, children }) {
  return (
    <li
      className="flex items-center gap-2 rounded-md px-2 py-1 text-foreground/90 transition-colors hover:bg-accent"
      style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
    >
      {icon ?? <span className="text-muted-foreground">·</span>}
      <span>{children}</span>
    </li>
  )
}

const FEATURES = [
  {
    icon: FolderTree,
    tag: 'depuis GitHub',
    title: 'Tes cours, versionnés',
    desc: 'Range tes PDF, images et notes markdown en collections. Accessibles partout, pour toujours.',
    soon: false,
  },
 /*  {
    icon: Search,
    tag: 'révision express',
    title: 'Recherche plein-texte',
    desc: 'Tape un mot-clé et retrouve le bon titre, fichier ou note en deux secondes.',
    soon: false,
  }, */
  {
    icon: Star,
    tag: 'depuis GitHub',
    title: 'Étoiles & cours populaires',
    desc: 'Étoile les meilleures ressources. Les cours les plus utiles remontent pour toute la promo.',
    soon: false,
  },
  {
    icon: Heart,
    tag: 'depuis Instagram',
    title: 'Feed & abonnements',
    desc: 'Suis tes amis, publie tes photos, vois ce que ta promo partage en temps réel.',
    soon: false,
  },
  {
    icon: MessagesSquare,
    tag: 'depuis WhatsApp',
    title: 'Chats & groupes',
    desc: 'Messages privés entre amis et groupes de classe, en temps réel, sans quitter l’app.',
    soon: false,
  },
  {
    icon: Radio,
    tag: 'depuis WhatsApp',
    title: 'Statuts éphémères',
    desc: 'Partage un moment de campus qui disparaît après 24 h — et vois qui l’a vu.',
    soon: false,
  },
  {
    icon: BadgeCheck,
    tag: 'confiance',
    title: 'Comptes certifiés',
    desc: 'Profs et délégués reconnaissables d’une coche : tu sais à qui te fier.',
    soon: false,
  },
  /* {
    icon: Flame,
    tag: 'depuis Snapchat',
    title: 'Flammes & séries',
    desc: 'Garde la flamme avec tes binômes de révision. La régularité, ça se récompense.',
    soon: true,
  },
  {
    icon: Video,
    tag: 'depuis TikTok',
    title: 'Scroll vidéo',
    desc: 'Des capsules de révision en format court, à dérouler entre deux cours.',
    soon: true,
  }, */
]

function FeatureGrid() {
  return (
    <section className="py-12 sm:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Le meilleur de chaque appli,
          <br />
          <span className="text-muted-foreground">au service de ton école.</span>
        </h2>
        <span className="hidden font-meta text-xs text-muted-foreground sm:block">
          // mvp → v3
        </span>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="group relative flex flex-col rounded-xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <f.icon className="size-5" />
              </span>
              {f.soon && (
                <span className="rounded-full border border-ember/40 px-2 py-0.5 font-meta text-[10px] uppercase tracking-wide text-ember">
                  bientôt
                </span>
              )}
            </div>
            <p className="mt-4 font-meta text-xs text-muted-foreground">{f.tag}</p>
            <h3 className="mt-1 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {f.desc}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="py-12 sm:py-20">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center edge-hairline sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              'radial-gradient(30rem 20rem at 50% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%)',
          }}
        />
        <span className="mx-auto mb-6 inline-flex items-center gap-3">
          <LogoMark className="size-12" />
          <span className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Cirasphère
          </span>
        </span>
        <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold sm:text-5xl">
          Rejoins Cirasphère aujourd’hui.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          La communauté du savoir, l’avenir ensemble : dépose ton premier cours
          et ne perds plus jamais une note.
        </p>
        <Button asChild size="lg" className="mt-8 glow-primary">
          <Link to="/signup">
            Créer mon compte <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function GithubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.2-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.83 1.2 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5Z" />
    </svg>
  )
}

function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
        <Logo />
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
          <a
            href="https://github.com/dieumerci47/cfi-codex"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-meta text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubIcon className="size-4" />
            Code source sur GitHub
          </a>
          <p className="font-meta text-xs text-muted-foreground">
            © {new Date().getFullYear()} Cirasphère · CFI-CIRAS · Dieumerci-TSIMBA
          </p>
        </div>
      </div>
    </footer>
  )
}
