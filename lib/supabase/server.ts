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
  // isSupabaseConfigured() only vouches for the URL and the public key, so a
  // deployment missing just the secret key looks healthy everywhere else and
  // then fails at the one place it matters: writing the booking. Empty keys
  // reach PostgREST as an unauthenticated request and come back as a generic
  // authorisation error that says nothing about the real cause.
  if (!supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not set. " +
        "Bookings cannot be written without it."
    );
  }

  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );
  return createSupabaseClient(supabaseUrl, supabaseSecretKey);
}
