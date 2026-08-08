/**
 * Supabase credentials, resolved across both naming schemes.
 *
 * Connecting a project through Supabase's Vercel integration provisions
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY — Supabase's
 * newer key names. Configuring by hand from the dashboard produces the older
 * NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Both are accepted. The alternative is asking whoever sets up the project to
 * hand-copy duplicate variables under the legacy names, which silently go stale
 * the first time the integration rotates its keys.
 *
 * These must be direct `process.env.X` member reads: Next.js inlines
 * NEXT_PUBLIC_* values by literal text substitution at build time, so dynamic
 * or destructured access would leave them undefined in the browser bundle.
 */

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

/**
 * False while the project is unconfigured, which is what keeps the site in its
 * demo mode instead of throwing. "placeholder" is what .env.local.example ships.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && !supabaseUrl.includes("placeholder") && supabasePublicKey
  );
}
