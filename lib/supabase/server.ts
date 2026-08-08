import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabasePublicKey, supabaseSecretKey } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components we can't set cookies — this is fine
          }
        },
      },
    }
  );
}

/**
 * Cookie-free client for reading public tables (services, availability), which
 * carry a "Public read" RLS policy and need no session.
 *
 * The cookie-based client above calls next/headers `cookies()`, which forces a
 * route to render dynamically — and only when Supabase happens to be
 * configured, so a page would silently switch between static and dynamic
 * depending on the environment. This keeps that decision explicit.
 */
export async function createPublicClient() {
  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );
  return createSupabaseClient(supabaseUrl, supabasePublicKey);
}

export async function createServiceClient() {
  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );
  return createSupabaseClient(supabaseUrl, supabaseSecretKey);
}
