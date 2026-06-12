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

## 📈 Algorithme du feed & des suggestions (passage à l'échelle)

> À relire le jour où la base grossit et où il y a beaucoup d'utilisateurs.

**Fondations déjà en place (pensées pour l'échelle) :**

- **Compteurs dénormalisés** maintenus par triggers : `posts.like_count`,
  `posts.comment_count`, `profiles.follower_count`, `profiles.following_count`.
  → plus aucune agrégation à la lecture du feed (lecture O(1)).
- **Index** : `posts(created_at desc, id desc)`, `posts(author_id, created_at desc)`,
  `follows(following_id)`, et **GIN `pg_trgm`** sur `profiles.username` / `full_name`.
- Toute la sélection/classement se fait **côté SQL via des RPC** (on ne transporte
  que la page demandée) ; les fonctions de triggers `SECURITY DEFINER` sont
  **non appelables** par l'API REST (`REVOKE EXECUTE … FROM public`).

**Feed hybride (RPC) :**

- `feed_recent_ranked` → posts **< 72 h** du réseau (cold-start = toute l'école si
  tu ne suis personne), classés par score :
  `(affinité + 0.5·ln(1+likes) + 0.7·ln(1+comments)) / (âge_h + 2)^1.5`
  (affinité = même promo + abonnement mutuel).
- `feed_chrono` → posts **> 72 h**, chronologique en **keyset** (curseur `created_at`).
- Front : `useInfiniteQuery` (page 0 = récent classé, puis chrono) + infinite scroll.
  La frontière fixe à 72 h garantit **zéro doublon** entre les deux zones.

**⚠️ Limite connue — fenêtre récente plafonnée à 25 :**
`feed_recent_ranked` ne renvoie que le **top 25 par score** parmi les posts < 72 h.

- Cas normal (réseau qui poste **≤ 25 fois** en 72 h) → **tout est affiché**, aucun trou.
  C'est le cas quasi systématique à l'échelle d'une école.
- Cas limite (réseau **> 25 posts / 72 h**) → les posts classés 26ᵉ+ sont < 72 h mais
  hors du top 25, donc temporairement ni dans la zone récente, ni (encore) dans le
  chrono (qui ne prend que **> 72 h**).
- **Auto-correctif** : dès qu'un de ces posts **franchit les 72 h**, il bascule dans le
  chrono et réapparaît. Comme le score pénalise fortement l'ancienneté, les « perdants »
  sont déjà vieux → ils franchissent la frontière en quelques heures. Rien n'est perdu
  définitivement (le client déduplique aussi par `id`).

**Leviers si ça devient gênant (réseau très actif) :**

1. **Monter le plafond** (ex. 25 → 50) dans `feed_recent_ranked(p_limit)`.
2. **Paginer la zone récente** elle-même par score (keyset sur `(score, id)`).
3. **Mélanger** récent + chrono en une seule liste fenêtrée (re-rang sur fenêtre glissante).
4. **Vues matérialisées** rafraîchies périodiquement (suggestions, top posts).
5. En tout dernier recours et seulement à très grande échelle : **timeline en fan-out**
   (table de feed précalculée par utilisateur à l'écriture).

**Suggestions & recherche de personnes (Explorer, RPC) :**

- `suggest_people` → `3·même_promo + 2·amis_communs + 0.5·ln(1+followers) + aléa`
  (exclut déjà-suivis ; affiche la raison de la suggestion). À très grande échelle,
  borner le pool de candidats (même promo ∪ amis-d'amis ∪ top populaires) ou passer
  en vue matérialisée.
- `search_people` → **trigram** (`similarity` + opérateur `%`) + `ilike`, classé par
  similarité → rapide et tolérant aux fautes grâce à l'index GIN.

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
