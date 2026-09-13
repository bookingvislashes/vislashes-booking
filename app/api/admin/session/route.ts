import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Is whoever is asking signed in to the admin?
 *
 * Only the booking page's test mode calls this, and only when ?test=1 is in
 * the URL — so a real client's checkout never makes the request. It answers
 * a boolean and nothing else: no email, no id, nothing worth having.
 */
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ admin: false });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return NextResponse.json({ admin: Boolean(user) });
  } catch {
    return NextResponse.json({ admin: false });
  }
}
