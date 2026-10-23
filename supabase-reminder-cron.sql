-- Run this only after deploying the send-reminders Edge Function.
-- Replace both placeholder values before executing this file.
-- Use the project's legacy anon JWT here because Edge Function JWT verification
-- requires a JWT. The value remains encrypted in Supabase Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'xiaoji_project_url'
);

select vault.create_secret(
  'YOUR_LEGACY_ANON_KEY',
  'xiaoji_anon_key'
);

select cron.schedule(
  'xiaoji-send-reminders-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'xiaoji_project_url'
      ) || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'xiaoji_anon_key'
        ),
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'xiaoji_anon_key'
        )
      ),
      body := jsonb_build_object('invoked_at', now())
    );
  $$
);
