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

export async function createServiceClient() {
  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );
  return createSupabaseClient(supabaseUrl, supabaseSecretKey);
}
