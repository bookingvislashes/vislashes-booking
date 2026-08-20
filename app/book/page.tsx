import { Header } from "@/components/layout/Header";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Re-read the menu at most once a minute, so edits made in the admin dashboard
// appear without waiting for a redeploy.
export const revalidate = 60;

// Demo menu, used only while Supabase is unconfigured so the page still renders
// something during local development and preview deploys.
//
// These IDs are deliberately NOT valid UUIDs. bookings.service_id is
// `uuid references services(id)`, so a booking submitted against this list
// cannot be saved — which is correct: without a database there is nowhere to
// save it. Once Supabase is configured, getServices() returns real rows with
// real UUIDs and bookings persist.
//
// Matches her actual live menu (supabase/migrations/004_real_service_menu.sql
// carries the same four services onto the real database), so a misconfigured
// preview never shows placeholder services under the real brand.
const fallbackServices = [
  {
    id: "svc-classic",
    name: "Classic Set",
    description:
      "Wake up to naturally defined lashes every day. Clean, flutter-worthy, and never overdone. Perfect for first-timers or anyone wanting effortless polish without the drama. One extension per natural lash — your eyes, enhanced.",
    category: "full_set",
    price: 85.0,
    deposit_amount: 25.0,
    duration_minutes: 70,
    image_url: null,
    image_focus_y: 50,
  },
  {
    id: "svc-wispy",
    name: "Wispy Set",
    description:
      "Feathery, dimensional, and a little bit editorial. The \"I woke up like this\" lash — fluffy enough to be noticed, soft enough to be effortless. If you want lashes that photograph beautifully, this is your style.",
    category: "full_set",
    price: 100.0,
    deposit_amount: 25.0,
    duration_minutes: 80,
    image_url: null,
    image_focus_y: 50,
  },
  {
    id: "svc-hybrid",
    name: "Hybrid Set",
    description:
      "Our most-requested style. Fuller than Classic, softer than full Volume — the sweet spot. Half classic extensions, half wispy fans, all gorgeous. Looks just as good in real life as it does in photos.",
    category: "full_set",
    price: 110.0,
    deposit_amount: 25.0,
    duration_minutes: 90,
    image_url: null,
    image_focus_y: 50,
  },
  {
    id: "svc-lash-lift",
    name: "Lash Lift",
    description:
      "No extensions. No fills. Just your own lashes, lifted and tinted to look impossibly long and curled for 6–8 weeks straight. Zero maintenance, maximum impact. Perfect between extension sets or on its own.",
    category: "lift",
    price: 70.0,
    deposit_amount: 25.0,
    duration_minutes: 60,
    image_url: null,
    image_focus_y: 50,
  },
];

async function getServices() {
  if (!isSupabaseConfigured()) return fallbackServices;

  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("services")
      .select(
        "id, name, description, category, price, deposit_amount, duration_minutes, image_url, image_focus_y"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data?.length) return fallbackServices;

    // Postgres `numeric` arrives as a string over PostgREST; the booking flow
    // does arithmetic on price and deposit, so coerce before handing it on.
    return data.map((s) => ({
      ...s,
      price: Number(s.price),
      deposit_amount: Number(s.deposit_amount),
      // image_url used to be hardcoded null here, which is why every card
      // rendered a flat tan block no matter what was stored.
      image_url: s.image_url ?? null,
      image_focus_y: s.image_focus_y ?? 50,
    }));
  } catch {
    return fallbackServices;
  }
}

/**
 * Removal price and length live in settings so they can be changed without a
 * developer. Read here and passed down rather than looked up in the browser,
 * so the figure a customer is shown comes from the same place the server
 * charges from.
 */
async function getRemoval() {
  const fallback = { price: 25, minutes: 30 };
  if (!isSupabaseConfigured()) return fallback;

  try {
    const supabase = await createPublicClient();
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["removal_price", "removal_duration_minutes"]);

    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    const price = Number(map.removal_price);
    const minutes = Number(map.removal_duration_minutes);
    return {
      price: Number.isFinite(price) ? price : fallback.price,
      minutes: Number.isFinite(minutes) ? minutes : fallback.minutes,
    };
  } catch {
    return fallback;
  }
}

export default async function BookPage() {
  const [services, removal] = await Promise.all([getServices(), getRemoval()]);

  return (
    <div className="min-h-[100dvh] bg-cream">
      <Header />
      <main className="max-w-[640px] mx-auto px-6 py-8">
        <BookingFlow
          services={services}
          removalPrice={removal.price}
          removalMinutes={removal.minutes}
        />
      </main>
    </div>
  );
}
