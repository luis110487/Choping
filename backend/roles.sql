-- Ejecutar una vez en Supabase > SQL Editor.

alter table public.profiles
  add column if not exists role text not null default 'cliente';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('cliente', 'tienda', 'admin', 'superadmin'));

create index if not exists profiles_role_idx on public.profiles(role);
