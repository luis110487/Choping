-- Ejecutar una vez en Supabase > SQL Editor.

alter table public.profiles
  add column if not exists role text not null default 'cliente';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('cliente', 'tienda', 'admin', 'superadmin'));

create index if not exists profiles_role_idx on public.profiles(role);

-- Asigna el superadmin existente. La contraseña continúa administrándose
-- mediante SUPERADMIN_PASSWORD en Render hasta integrar Supabase Auth.
update public.profiles
set role = 'superadmin'
where lower(email) in (
  'luis.gamarra@techdatasync.com',
  'luis.gamarra@techdatasaync.com',
  'luis.gamarra@techdatasyn.com'
);
