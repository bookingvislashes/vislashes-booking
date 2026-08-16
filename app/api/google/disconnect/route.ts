import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { clearConnection } from "@/lib/google-calendar";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = await createServiceClient();
    // Revokes at Google as well as deleting the stored token — see
    // clearConnection. Existing events are left alone: they are her
    // appointments, and silently wiping her calendar on disconnect would be
    // the more surprising behaviour by far.
    await clearConnection(admin);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Google Calendar: disconnect failed:", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
