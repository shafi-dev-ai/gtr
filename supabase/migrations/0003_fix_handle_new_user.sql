-- Ensure profiles are auto-created on signup with metadata (matches docs/init_schema.sql)
-- This replaces the handle_new_user function with the latest version and keeps the existing trigger.

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  raw_user jsonb;
  raw_app jsonb;
begin
  raw_user := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  raw_app := coalesce(new.raw_app_meta_data, '{}'::jsonb);

  begin
    insert into public.profiles (
      id,
      username,
      full_name,
      email,
      avatar_url,
      phone_number,
      created_at,
      updated_at
    )
    values (
      new.id,
      coalesce(
        raw_user->> 'username',
        raw_user->> 'preferred_username',
        raw_user->> 'user_name',
        null
      ),
      coalesce(
        raw_user->> 'full_name',
        raw_user->> 'name',
        case
          when raw_user->> 'given_name' is not null then trim(coalesce(raw_user->> 'given_name','') || ' ' || coalesce(raw_user->> 'family_name',''))
          else null
        end,
        raw_user->> 'display_name',
        raw_app->> 'full_name',
        raw_app->> 'name',
        ''
      ),
      coalesce(new.email, ''),
      coalesce(
        raw_user->> 'avatar_url',
        raw_user->> 'picture',
        raw_user->> 'avatar',
        raw_app->> 'avatar_url',
        raw_app->> 'picture',
        null
      ),
      coalesce(raw_user->> 'phone_number', new.phone, null),
      now(),
      now()
    )
    on conflict (id) do update set
      username = excluded.username,
      full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
      email = coalesce(nullif(excluded.email, ''), profiles.email),
      avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
      phone_number = coalesce(excluded.phone_number, profiles.phone_number),
      updated_at = now();

  exception
    when others then
      insert into public.profile_creation_errors (user_id, error_message) values (new.id, sqlerrm);
      raise notice 'Profile creation failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

grant execute on function public.handle_new_user() to anon;
grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.handle_new_user() to service_role;
