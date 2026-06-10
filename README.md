# 📖 Codex — le réseau de partage de cours de ton école

> Le **GitHub des cours** mêlé au meilleur du réseau social étudiant.
> Archive tes notes et tes PDF, retrouve-les sur n'importe quel appareil — même
> dans deux ans — suis tes camarades et partage ce que tu apprends.

Codex est un réseau social scolaire dont le **cœur est un dépôt de cours
persistant et collaboratif** (façon GitHub), entouré d'une couche sociale légère
(profils, abonnements, feed). Projet portfolio.

---

## ✨ Fonctionnalités (v1)

- **Authentification** par email + onboarding (pseudo, nom, promo).
- **Collections de cours** = des « classes » ou matières. Arborescence de
  **dossiers / fichiers / notes markdown** à profondeur illimitée.
  - Upload multiple + **glisser-déposer**, renommage, suppression.
  - **Visualiseur** intégré : PDF, images, notes markdown.
  - **Portée** publique (toute l'école) ou privée.
- **Collaboration** : le propriétaire invite des **éditeurs** (ex. chef de classe
  + adjoint) qui peuvent ajouter des documents ; les autres peuvent **suivre**
  la collection en lecture/téléchargement seul.
- **Social** : feed, publications (texte + photos), abonnements, likes,
  commentaires, partage d'une collection dans le feed, recherche d'élèves.
- **Thème sombre / clair** (dark par défaut), design « Le Codex » (éditorial +
  développeur).

### Roadmap

- **v2** : chat & groupes (temps réel), statuts éphémères 24 h.
- **v3** : flammes / séries, scroll vidéo.

---

## 🛠️ Stack

| | |
|---|---|
| **Front** | React (JS) · Vite · React Router · TanStack Query |
| **UI** | Tailwind CSS v4 · shadcn/ui · lucide-react |
| **Formulaires** | react-hook-form · zod |
| **Backend** | Supabase (Auth · Postgres · Storage · RLS) |
| **Fonts** | Fraunces · Plus Jakarta Sans · JetBrains Mono |

---

## 🚀 Démarrage

```bash
pnpm install

# Configure Supabase
cp .env.example .env.local
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...

pnpm dev
```

### Base de données

Le schéma (tables `profiles`, `follows`, `subjects`, `collections`,
`resources`, `collection_members`, `posts`, `post_media`, `likes`, `comments`),
les policies **RLS** et les buckets storage (`avatars`, `post-media`,
`resources`) sont gérés via les migrations Supabase du projet.

### Scripts de test (data layer)

```bash
node scripts/smoke-test.mjs    # auth, collections, RLS
node scripts/social-smoke.mjs  # posts, likes, commentaires, follow
```

---

## 📁 Structure

```
src/
  lib/          # client Supabase, hooks de données (TanStack Query)
  components/   # UI réutilisable (shadcn + composants métier)
  features/     # auth (providers, guards)
  routes/       # pages (landing, auth, onboarding, app/*)
```

---

🤖 Développé avec [Claude Code](https://claude.com/claude-code).
