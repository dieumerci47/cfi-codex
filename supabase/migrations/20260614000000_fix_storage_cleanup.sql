-- ============================================================================
-- Fix : « Direct deletion from storage tables is not allowed »
--
-- Supabase a ajouté un trigger storage.protect_delete() qui bloque tout DELETE
-- direct sur storage.objects. Or nos triggers de nettoyage (suppression d'une
-- ressource, d'un média de post, d'un statut, ou changement d'avatar) font
-- exactement ce DELETE pour purger le fichier associé. Résultat : toute
-- suppression de fichier/dossier échouait avec ce message remonté à l'utilisateur.
--
-- Correctif : chaque fonction de nettoyage active le flag transaction-local
-- `storage.allow_delete_query` avant son DELETE (mécanisme officiel de bypass).
-- Idempotent (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_resource_storage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.storage_path is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects
      where bucket_id = 'resources' and name = old.storage_path;
  end if;
  return old;
end; $function$;

CREATE OR REPLACE FUNCTION public.cleanup_post_media_storage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.storage_path is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects
      where bucket_id = 'post-media' and name = old.storage_path;
  end if;
  return old;
end; $function$;

CREATE OR REPLACE FUNCTION public.cleanup_status_storage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.media_path is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects
      where bucket_id = 'status-media' and name = old.media_path;
  end if;
  return old;
end; $function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_avatar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare oldpath text;
begin
  if new.avatar_url is distinct from old.avatar_url and old.avatar_url is not null then
    oldpath := split_part(old.avatar_url, '/avatars/', 2);
    if oldpath is not null and oldpath <> '' then
      perform set_config('storage.allow_delete_query', 'true', true);
      delete from storage.objects where bucket_id = 'avatars' and name = oldpath;
    end if;
  end if;
  return new;
end; $function$;
