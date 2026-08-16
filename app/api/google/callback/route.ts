import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { saveConnectionFromCode } from "@/lib/google-calendar";
import { OAUTH_STATE_COOKIE } from "../connect/route";

function settingsRedirect(status: string) {
  return NextResponse.redirect(
    new URL(`/admin/settings?google=${status}`, process.env.NEXT_PUBLIC_BASE_URL)
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // She pressed Cancel on Google's consent screen. Not an error worth a scary
  // message — just put her back where she started.
  if (searchParams.get("error")) return settingsRedirect("cancelled");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect("invalid_state");
  }

  try {
    // Service client: the connection table has RLS on with no policies, so it
    // is deliberately unreachable with the browser's key. See migration 006.
    const admin = await createServiceClient();
    const result = await saveConnectionFromCode(admin, code);

    if (!result) return settingsRedirect("no_refresh_token");
    return settingsRedirect("connected");
  } catch (err) {
    console.error("Google Calendar: connection failed:", err);
    return settingsRedirect("failed");
  }
}
