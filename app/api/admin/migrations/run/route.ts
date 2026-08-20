import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isMigrationsConfigured } from "@/lib/supabase/env";
import { runMigrationFile } from "@/lib/migrations";

const schema = z.object({ filename: z.string().min(1) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMigrationsConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_DB_URL is not set." },
      { status: 400 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await runMigrationFile(input.filename);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Migration failed." },
      { status: 500 }
    );
  }
}
