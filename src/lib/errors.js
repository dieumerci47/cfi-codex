/**
 * Traduit n'importe quelle erreur (Supabase, Postgres, réseau, JS) en un message
 * clair et rassurant en français, destiné à un toast.
 *
 * Règles :
 *  1. Si l'erreur correspond à un motif technique connu → message dédié.
 *  2. Si le message est visiblement « écrit pour l'humain » (nos exceptions RPC
 *     en français, sans jargon) → on le garde tel quel.
 *  3. Sinon (jargon technique, anglais, codes Postgres…) → on renvoie le
 *     `fallback` contextuel fourni par l'appelant. L'utilisateur ne voit
 *     JAMAIS un message technique brut.
 */

// Motifs techniques connus → message clair. Ordre = priorité.
const PATTERNS = [
  [/direct deletion from storage|protect_delete|allow_delete_query/i,
    'Impossible de supprimer le fichier pour le moment. Réessaie dans un instant.'],
  [/failed to fetch|networkerror|network request failed|fetch failed|err_/i,
    'Connexion au serveur impossible. Vérifie ta connexion internet et réessaie.'],
  [/dynamically imported module|loading chunk|importing a module script/i,
    'Une mise à jour est disponible. Recharge la page (Ctrl/Cmd + R).'],
  [/invalid login credentials/i, 'Email ou mot de passe incorrect.'],
  [/email not confirmed/i,
    'Ton email n’est pas encore confirmé — vérifie ta boîte mail (et tes spams).'],
  [/already registered|user already exists/i,
    'Cette adresse a déjà un compte. Connecte-toi plutôt.'],
  [/password should be at least|password.*too short|weak.?password/i,
    'Mot de passe trop court (6 caractères minimum).'],
  [/rate limit|too many requests|status.*429/i,
    'Trop de tentatives. Patiente quelques minutes avant de réessayer.'],
  [/jwt|token is expired|invalid claim|session.*expired|not authenticated|non authentifié/i,
    'Ta session a expiré. Reconnecte-toi.'],
  [/row-level security|permission denied|not authorized|violates row-level|insufficient_privilege/i,
    'Tu n’as pas les droits pour cette action.'],
  [/duplicate key|already exists|unique constraint|23505/i,
    'Cet élément existe déjà.'],
  [/foreign key|not-null|check constraint|23502|23503|23514/i,
    'Action impossible : une information requise est manquante ou invalide.'],
  [/payload too large|exceeded the maximum|object exceeded|413/i,
    'Fichier trop volumineux.'],
  [/duplicate.*storage|already exists.*storage|resource already exists/i,
    'Un fichier portant ce nom existe déjà.'],
]

// Marqueurs qui trahissent un message technique : on ne l'affiche jamais brut.
const TECHNICAL =
  /[{}[\]]|->|violat|constraint|syntax|null value|relation\s|column\s|schema\s|bucket_id|pg_|pgrst|storage\.|auth\.|supabase|https?:|undefined|typeerror|referenceerror|\bnull\b|stack|exception|0x[0-9a-f]/i

export function friendlyError(err, fallback = 'Une erreur est survenue. Réessaie.') {
  const raw =
    typeof err === 'string'
      ? err
      : (err?.message ?? err?.error_description ?? err?.error ?? '')

  for (const [test, msg] of PATTERNS) {
    if (test.test(raw)) return msg
  }

  // Message volontairement rédigé en français par notre code/RPC → on le garde.
  if (raw && raw.length < 160 && !TECHNICAL.test(raw)) return raw

  return fallback
}
