import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMigrationsConfigured } from "@/lib/supabase/env";
import { getMigrationStatus } from "@/lib/migrations";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMigrationsConfigured()) {
    return NextResponse.json({ configured: false, migrations: [] });
  }

  try {
    const migrations = await getMigrationStatus();
    return NextResponse.json({ configured: true, migrations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't reach the database." },
      { status: 500 }
    );
  }
}
