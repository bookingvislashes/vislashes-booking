import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabasePublicKey } from "./env";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublicKey);
}
