import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Imports an Acuity client export.
 *
 * Matching is deliberately layered, because the export is messier than the
 * clients table assumes: of the 159 rows in the salon's own file, 47 have no
 * email address at all, 2 have no phone, and 3 email addresses repeat. Import
 * by email alone and a third of her regulars never arrive — and since refills
 * unlock by recognising a returning client, those are exactly the people the
 * unlock exists for.
 *
 * So: match on email when there is one, otherwise on the last ten digits of
 * the phone, and only create a row when neither finds anything. Re-running the
 * same file updates rather than duplicates.
 */

const rowSchema = z.object({
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  daysSinceLastAppointment: z.string().optional().default(""),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(5000),
});

function digits(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(-10);
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rows: z.infer<typeof schema>["rows"];
  try {
    rows = schema.parse(await req.json()).rows;
  } catch {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const admin = await createServiceClient();

  // Loaded once and matched in memory. At a single salon's scale this is a few
  // hundred rows, and it avoids a query per line of the file.
  const { data: existing, error: loadError } = await admin
    .from("clients")
    .select("id, email, phone")
    .limit(10000);

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const c of existing || []) {
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), c.id);
    const d = digits(c.phone || "");
    if (d.length === 10) byPhone.set(d, c.id);
  }

  // Read once rather than per row.
  const { data: businessRow } = await admin
    .from("settings")
    .select("value")
    .eq("key", "business_email")
    .maybeSingle();
  const businessEmail = (businessRow?.value || "").trim().toLowerCase();
  const fromEmail = (process.env.EMAIL_FROM || "").trim().toLowerCase();

  const today = new Date();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const fullName = `${row.firstName} ${row.lastName}`.trim();
    let email = row.email.trim().toLowerCase();

    // The salon's own address was sometimes entered for clients who had none.
    // Kept as a client email it would collide on the unique constraint after
    // the first row, and would hand refill access to anyone who typed the
    // address printed on the website. Such rows import on phone alone.
    if (email && (email === businessEmail || email === fromEmail)) {
      email = "";
    }
    const phone = row.phone.trim();
    const phoneDigits = digits(phone);

    // Nothing to file this person under, and no way to ever recognise them.
    if (!fullName && !email && !phoneDigits) {
      skipped += 1;
      continue;
    }
    if (email && !isEmail(email)) {
      skipped += 1;
      continue;
    }

    // Acuity gives days-since rather than a date. Converted so her admin shows
    // a real last visit instead of "No visits yet" for a decade-long regular.
    let lastVisit: string | null = null;
    const days = parseInt(row.daysSinceLastAppointment, 10);
    if (Number.isFinite(days) && days >= 0 && days < 40000) {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      lastVisit = d.toISOString().slice(0, 10);
    }

    const match =
      (email && byEmail.get(email)) ||
      (phoneDigits.length === 10 ? byPhone.get(phoneDigits) : undefined);

    const payload = {
      full_name: fullName || "Unknown",
      email: email || null,
      phone: phone || null,
      notes: row.notes.trim() || null,
      last_visit_date: lastVisit,
      imported_from: "acuity",
      updated_at: new Date().toISOString(),
    };

    if (match) {
      // Existing rows keep their visit_count — it is derived from appointments
      // actually completed on this site, and the export cannot improve on it.
      const { error } = await admin
        .from("clients")
        .update(payload)
        .eq("id", match);
      if (error) {
        skipped += 1;
        continue;
      }
      updated += 1;
    } else {
      const { data: inserted, error } = await admin
        .from("clients")
        .insert({
          ...payload,
          // They have been at least once — that is what being in this export
          // means — so they read as returning rather than brand new.
          visit_count: 1,
        })
        .select("id")
        .single();

      if (error || !inserted) {
        skipped += 1;
        continue;
      }
      created += 1;

      // Registered so a duplicate later in the same file updates this row
      // rather than failing against the unique email constraint.
      if (email) byEmail.set(email, inserted.id);
      if (phoneDigits.length === 10) byPhone.set(phoneDigits, inserted.id);
    }
  }

  return NextResponse.json({ created, updated, skipped, total: rows.length });
}
