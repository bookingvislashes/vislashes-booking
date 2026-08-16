import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl, isGoogleConfigured } from "@/lib/google-calendar";

export const OAUTH_STATE_COOKIE = "google_oauth_state";

/**
 * Starts the Google consent flow. Admin-only: without this check any visitor
 * could begin an authorisation against the salon's own client credentials.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/admin/settings?google=unconfigured", process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  // CSRF: Google echoes this back, and the callback refuses anything that
  // does not match the cookie. Without it, an attacker could hand the salon
  // a callback URL that connects *their* calendar to this admin.
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(await getAuthUrl(state));
}
