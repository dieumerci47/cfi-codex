-- ============================================================================
-- Snapshot des fonctions (RPC + triggers) de la base CFI_Social
-- Extrait de la prod (projet emkzxujdulnmzkqzmbfa) le 2026-06-12.
--
-- Rejouable tel quel sur une instance dont les TABLES existent déjà :
-- ce fichier ne couvre ni le schéma des tables ni les policies RLS.
-- Tout est en CREATE OR REPLACE / DROP IF EXISTS → idempotent.
-- ============================================================================

create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- Helpers (utilisés par les policies RLS et d'autres fonctions)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from follows where follower_id = a and following_id = b)
     and exists (select 1 from follows where follower_id = b and following_id = a);
$function$;

CREATE OR REPLACE FUNCTION public.can_view_collection(cid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from collections c
                where c.id = cid and (c.visibility = 'public' or c.owner_id = auth.uid()))
      or exists(select 1 from collection_members m
                where m.collection_id = cid and m.user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_collection_editor(cid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from collections c where c.id = cid and c.owner_id = auth.uid())
      or exists(select 1 from collection_members m
                where m.collection_id = cid and m.user_id = auth.uid() and m.role = 'editor');
$function$;

CREATE OR REPLACE FUNCTION public.is_collection_owner(cid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from collections c where c.id = cid and c.owner_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(conv uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from conversation_members m
    where m.conversation_id = conv and m.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_owner(conv uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from conversations c
    where c.id = conv and c.created_by = auth.uid()
  );
$function$;

-- ----------------------------------------------------------------------------
-- RPC appelées par le client (src/lib/queries/*.js)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.feed_recent_ranked(p_limit integer DEFAULT 25)
 RETURNS TABLE(post_id uuid, score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as uid),
  myp as (select promo from profiles where id = (select uid from me)),
  fc as (select count(*) c from follows where follower_id = (select uid from me)),
  cand as (
    select p.*
    from posts p
    where p.created_at > now() - interval '72 hours'
      and (
        ((select c from fc) > 0 and (
            p.author_id = (select uid from me)
            or p.author_id in (select following_id from follows where follower_id = (select uid from me))
        ))
        or ((select c from fc) = 0)
      )
  )
  select c.id,
    (
      (
        (case when c.author_id <> (select uid from me)
              and (select promo from myp) is not null
              and (select promo from profiles where id = c.author_id) = (select promo from myp)
              then 1.0 else 0.0 end)
        + (case when exists(
              select 1 from follows f
              where f.follower_id = c.author_id and f.following_id = (select uid from me)
           ) then 0.5 else 0.0 end)
        + 0.5 * ln(1 + c.like_count)
        + 0.7 * ln(1 + c.comment_count)
      )
      / power(extract(epoch from (now() - c.created_at)) / 3600.0 + 2, 1.5)
    )::real as score
  from cand c
  order by score desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.feed_chrono(p_before timestamp with time zone, p_limit integer DEFAULT 15)
 RETURNS TABLE(post_id uuid, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as uid),
  fc as (select count(*) c from follows where follower_id = (select uid from me))
  select p.id, p.created_at
  from posts p
  where p.created_at < p_before
    and (
      ((select c from fc) > 0 and (
          p.author_id = (select uid from me)
          or p.author_id in (select following_id from follows where follower_id = (select uid from me))
      ))
      or ((select c from fc) = 0)
    )
  order by p.created_at desc, p.id desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.suggest_people(p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, username text, full_name text, avatar_url text, promo text, bio text, is_verified boolean, follower_count integer, mutual_count integer, same_promo boolean, score real)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as uid),
  myp as (select promo from profiles where id = (select uid from me)),
  myfollows as (select following_id from follows where follower_id = (select uid from me)),
  cand as (
    select pr.id, pr.username, pr.full_name, pr.avatar_url, pr.promo, pr.bio,
           pr.is_verified, pr.follower_count,
           (select count(*)::int from follows f
              where f.following_id = pr.id
                and f.follower_id in (select following_id from myfollows)
           ) as mutual_count,
           (pr.promo is not null and pr.promo = (select promo from myp)) as same_promo
    from profiles pr
    where pr.id <> (select uid from me)
      and pr.username is not null
      and pr.id not in (select following_id from myfollows)
  )
  select c.id, c.username, c.full_name, c.avatar_url, c.promo, c.bio,
         c.is_verified, c.follower_count, c.mutual_count, c.same_promo,
    ( 3.0 * (case when c.same_promo then 1 else 0 end)
      + 2.0 * c.mutual_count
      + 0.5 * ln(1 + c.follower_count)
      + random() * 0.5
    )::real as score
  from cand c
  order by score desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.search_people(p_q text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, username text, full_name text, avatar_url text, promo text, bio text, is_verified boolean, follower_count integer, sim real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as uid)
  select pr.id, pr.username, pr.full_name, pr.avatar_url, pr.promo, pr.bio,
         pr.is_verified, pr.follower_count,
         greatest(
           similarity(pr.username, p_q),
           similarity(coalesce(pr.full_name, ''), p_q)
         )::real as sim
  from profiles pr
  where pr.id <> (select uid from me)
    and pr.username is not null
    and (
      pr.username ilike '%' || p_q || '%'
      or pr.full_name ilike '%' || p_q || '%'
      or pr.username % p_q
      or coalesce(pr.full_name, '') % p_q
    )
  order by sim desc, pr.follower_count desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.search_courses(q text)
 RETURNS TABLE(result_kind text, collection_id uuid, collection_title text, resource_id uuid, name text, snippet text)
 LANGUAGE sql
 STABLE
AS $function$
  with tq as (select websearch_to_tsquery('french', q) as query)
  select
    'collection'::text,
    c.id,
    c.title,
    null::uuid,
    c.title,
    ts_headline('french', coalesce(nullif(c.description, ''), c.title), tq.query,
      'StartSel=«,StopSel=»,MaxFragments=1,MaxWords=20,MinWords=4')
  from public.collections c, tq
  where q <> '' and c.search_vector @@ tq.query
  union all
  select
    r.kind,
    r.collection_id,
    c.title,
    r.id,
    r.name,
    ts_headline('french', coalesce(nullif(r.note_content, ''), r.name), tq.query,
      'StartSel=«,StopSel=»,MaxFragments=1,MaxWords=20,MinWords=4')
  from public.resources r
  join public.collections c on c.id = r.collection_id, tq
  where q <> '' and r.search_vector @@ tq.query
  limit 50;
$function$;

CREATE OR REPLACE FUNCTION public.my_collections_unseen()
 RETURNS TABLE(collection_id uuid, unseen_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select r.collection_id, count(*)::bigint
  from resources r
  join collections c on c.id = r.collection_id
  left join collection_members cm
    on cm.collection_id = r.collection_id and cm.user_id = auth.uid()
  left join resource_seen rs
    on rs.resource_id = r.id and rs.user_id = auth.uid()
  where (c.owner_id = auth.uid() or cm.user_id is not null)
    and r.updated_at > coalesce(cm.created_at, c.created_at)
    and (rs.seen_at is null or rs.seen_at < r.updated_at)
  group by r.collection_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(other uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cid uuid;
  me uuid := auth.uid();
begin
  if other = me then raise exception 'Impossible de discuter avec soi-même'; end if;
  if not exists (select 1 from profiles where id = other) then
    raise exception 'Utilisateur introuvable';
  end if;
  if not public.are_friends(me, other) then
    raise exception 'Vous devez être amis (abonnement mutuel) pour discuter';
  end if;

  select c.id into cid
  from conversations c
  join conversation_members m1 on m1.conversation_id = c.id and m1.user_id = me
  join conversation_members m2 on m2.conversation_id = c.id and m2.user_id = other
  where c.is_group = false
    and (select count(*) from conversation_members mm where mm.conversation_id = c.id) = 2
  limit 1;

  if cid is not null then return cid; end if;

  insert into conversations (is_group, created_by) values (false, me) returning id into cid;
  insert into conversation_members (conversation_id, user_id, role)
  values (cid, me, 'admin'), (cid, other, 'member');
  return cid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_status_reply(p_status_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  author uuid;
  exp timestamptz;
  cid uuid;
begin
  select author_id, expires_at into author, exp from statuses where id = p_status_id;
  if author is null then raise exception 'Statut introuvable'; end if;
  if exp <= now() then raise exception 'Ce statut a expiré'; end if;
  if author = me then raise exception 'Impossible de répondre à son propre statut'; end if;
  -- le répondeur doit pouvoir voir le statut (suivre l'auteur)
  if not exists (
    select 1 from follows f where f.follower_id = me and f.following_id = author
  ) then
    raise exception 'Tu ne peux pas répondre à ce statut';
  end if;

  -- DM existant ?
  select c.id into cid
  from conversations c
  join conversation_members m1 on m1.conversation_id = c.id and m1.user_id = me
  join conversation_members m2 on m2.conversation_id = c.id and m2.user_id = author
  where c.is_group = false
    and (select count(*) from conversation_members mm where mm.conversation_id = c.id) = 2
  limit 1;

  if cid is null then
    insert into conversations (is_group, created_by) values (false, me) returning id into cid;
    insert into conversation_members (conversation_id, user_id, role)
    values (cid, me, 'admin'), (cid, author, 'member');
  end if;

  insert into messages (conversation_id, sender_id, body, status_id)
  values (cid, me, p_body, p_status_id);

  return cid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;
  -- avatars de l'utilisateur (les autres fichiers partent via les triggers de cascade)
  delete from storage.objects
    where bucket_id = 'avatars' and name like uid::text || '/%';
  -- supprime le compte → cascade profiles → posts/collections/messages/etc.
  delete from auth.users where id = uid;
end; $function$;

-- Maintenance : purge les fichiers storage orphelins (à lancer manuellement
-- ou via pg_cron).
CREATE OR REPLACE FUNCTION public.sweep_orphan_storage()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from storage.objects o
  where o.bucket_id = 'post-media'
    and not exists (select 1 from post_media m where m.storage_path = o.name);

  delete from storage.objects o
  where o.bucket_id = 'resources'
    and not exists (select 1 from resources r where r.storage_path = o.name);

  delete from storage.objects o
  where o.bucket_id = 'status-media'
    and not exists (select 1 from statuses s where s.media_path = o.name);

  delete from storage.objects o
  where o.bucket_id = 'avatars'
    and not exists (select 1 from profiles p where split_part(p.avatar_url, '/avatars/', 2) = o.name);
end; $function$;

-- ----------------------------------------------------------------------------
-- Fonctions trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bump_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.conversations set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bump_follow_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    update profiles set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update profiles set follower_count = greatest(0, follower_count - 1) where id = old.following_id;
  end if;
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.bump_post_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.bump_post_like_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare author uuid;
begin
  select author_id into author from posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id)
    values (author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare author uuid;
begin
  select author_id into author from posts where id = new.post_id;
  if author is not null and author <> new.author_id then
    insert into notifications (user_id, actor_id, type, post_id, comment_id)
    values (author, new.author_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_collection_invite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare owner uuid;
begin
  if new.role = 'editor' then
    select owner_id into owner from collections where id = new.collection_id;
    if owner is not null and owner <> new.user_id then
      insert into notifications (user_id, actor_id, type, collection_id)
      values (new.user_id, owner, 'collection_invite', new.collection_id);
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_resource_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  owner uuid;
  rec uuid;
begin
  -- À l'UPDATE, n'agir que si le nom ou le contenu de note a changé
  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and new.note_content is not distinct from old.note_content then
    return new;
  end if;

  select owner_id into owner from collections where id = new.collection_id;

  for rec in
    select uid from (
      select owner as uid
      union
      select user_id from collection_members where collection_id = new.collection_id
    ) r
    where uid is not null
      and uid <> coalesce(actor, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    insert into notifications (user_id, actor_id, type, collection_id, resource_id)
    values (rec, actor, 'collection_change', new.collection_id, new.id);
  end loop;

  -- L'auteur a déjà « vu » sa propre modif
  if actor is not null then
    insert into resource_seen (user_id, resource_id, seen_at)
    values (actor, new.id, now())
    on conflict (user_id, resource_id) do update set seen_at = excluded.seen_at;
  end if;

  return new;
end;
$function$;

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
      delete from storage.objects where bucket_id = 'avatars' and name = oldpath;
    end if;
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.cleanup_post_media_storage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.storage_path is not null then
    delete from storage.objects
      where bucket_id = 'post-media' and name = old.storage_path;
  end if;
  return old;
end; $function$;

CREATE OR REPLACE FUNCTION public.cleanup_resource_storage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.storage_path is not null then
    delete from storage.objects
      where bucket_id = 'resources' and name = old.storage_path;
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
    delete from storage.objects
      where bucket_id = 'status-media' and name = old.media_path;
  end if;
  return old;
end; $function$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_cleanup_old_avatar on public.profiles;
CREATE TRIGGER trg_cleanup_old_avatar AFTER UPDATE OF avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION cleanup_old_avatar();

drop trigger if exists trg_follow_counts on public.follows;
CREATE TRIGGER trg_follow_counts AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION bump_follow_counts();

drop trigger if exists trg_notify_follow on public.follows;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

drop trigger if exists trg_like_count on public.likes;
CREATE TRIGGER trg_like_count AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION bump_post_like_count();

drop trigger if exists trg_notify_like on public.likes;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION notify_on_like();

drop trigger if exists trg_comment_count on public.comments;
CREATE TRIGGER trg_comment_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION bump_post_comment_count();

drop trigger if exists trg_notify_comment on public.comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

drop trigger if exists trg_cleanup_post_media on public.post_media;
CREATE TRIGGER trg_cleanup_post_media AFTER DELETE ON public.post_media FOR EACH ROW EXECUTE FUNCTION cleanup_post_media_storage();

drop trigger if exists collections_set_updated_at on public.collections;
CREATE TRIGGER collections_set_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_notify_collection_invite on public.collection_members;
CREATE TRIGGER trg_notify_collection_invite AFTER INSERT ON public.collection_members FOR EACH ROW EXECUTE FUNCTION notify_on_collection_invite();

drop trigger if exists resources_set_updated_at on public.resources;
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_cleanup_resource on public.resources;
CREATE TRIGGER trg_cleanup_resource AFTER DELETE ON public.resources FOR EACH ROW EXECUTE FUNCTION cleanup_resource_storage();

drop trigger if exists trg_notify_resource_change on public.resources;
CREATE TRIGGER trg_notify_resource_change AFTER INSERT OR UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION notify_on_resource_change();

drop trigger if exists messages_bump on public.messages;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION bump_conversation();

drop trigger if exists trg_cleanup_status on public.statuses;
CREATE TRIGGER trg_cleanup_status AFTER DELETE ON public.statuses FOR EACH ROW EXECUTE FUNCTION cleanup_status_storage();
