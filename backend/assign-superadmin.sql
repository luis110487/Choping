-- Ejecutar despues de roles.sql en Supabase > SQL Editor.
-- profiles se relaciona con auth.users mediante el mismo id.

update public.profiles
set role = 'superadmin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('luis.gamarra@techdatasync.com')
  limit 1
);
