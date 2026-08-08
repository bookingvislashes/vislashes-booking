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
const fallbackServices = [
  {
    id: "svc-natural-glam",
    name: "Natural Glam",
    description: "A subtle, natural-looking lash set that enhances your everyday beauty.",
    category: "full_set",
    price: 50.0,
    deposit_amount: 10.0,
    duration_minutes: 110,
    image_url: null,
  },
  {
    id: "svc-premium-wispy",
    name: "Premium Wispy Glam",
    description: "Wispy, textured volume for a glamorous yet effortless look.",
    category: "full_set",
    price: 55.0,
    deposit_amount: 10.0,
    duration_minutes: 110,
    image_url: null,
  },
  {
    id: "svc-premium-custom",
    name: "Premium Wispy Glam (Custom)",
    description: "Fully customized wispy lash design tailored to your eye shape.",
    category: "full_set",
    price: 55.0,
    deposit_amount: 10.0,
    duration_minutes: 110,
    image_url: null,
  },
  {
    id: "svc-natural-refill",
    name: "Natural Glam Refill",
    description: "Maintain your Natural Glam set with a fresh fill.",
    category: "refill",
    price: 25.0,
    deposit_amount: 10.0,
    duration_minutes: 60,
    image_url: null,
  },
  {
    id: "svc-premium-refill",
    name: "Premium Wispy Glam Refill",
    description: "Keep your wispy volume looking flawless.",
    category: "refill",
    price: 30.0,
    deposit_amount: 10.0,
    duration_minutes: 60,
    image_url: null,
  },
  {
    id: "svc-premium-custom-refill",
    name: "Premium Wispy Glam Refill (Custom)",
    description: "Custom refill for your personalized wispy set.",
    category: "refill",
    price: 30.0,
    deposit_amount: 10.0,
    duration_minutes: 60,
    image_url: null,
  },
];

async function getServices() {
  if (!isSupabaseConfigured()) return fallbackServices;

  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("services")
      .select(
        "id, name, description, category, price, deposit_amount, duration_minutes"
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
      image_url: null,
    }));
  } catch {
    return fallbackServices;
  }
}

export default async function BookPage() {
  const services = await getServices();

  return (
    <div className="min-h-[100dvh] bg-cream">
      <Header />
      <main className="max-w-[640px] mx-auto px-6 py-8">
        <BookingFlow services={services} />
      </main>
    </div>
  );
}
