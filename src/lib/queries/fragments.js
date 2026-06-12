/**
 * Projection standard d'un profil dans les SELECT imbriqués Supabase.
 * À utiliser partout où un profil accompagne une ligne (auteur, expéditeur,
 * membre…) pour qu'un nouveau champ n'ait qu'un seul endroit à modifier.
 */
export const PROFILE_FIELDS = 'id, username, full_name, avatar_url, is_verified'
