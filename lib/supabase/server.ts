import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only: uses the service_role key, which must never reach the browser.
// This is a local, single-user, no-auth learning app, so RLS is disabled and
// every read/write goes through this one privileged client from API routes.
declare global {
  var __supabaseServerClient: SupabaseClient | undefined;
}

export function getSupabaseServerClient(): SupabaseClient {
  if (globalThis.__supabaseServerClient) {
    return globalThis.__supabaseServerClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars. Run `npx supabase start` and check .env.local.",
    );
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  globalThis.__supabaseServerClient = client;
  return client;
}
