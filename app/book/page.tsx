import { Header } from "@/components/layout/Header";
import { BookingFlow } from "@/components/booking/BookingFlow";

// For now, use static services data. In production, this will fetch from Supabase.
const services = [
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

export default function BookPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main className="max-w-[640px] mx-auto px-6 py-8">
        <BookingFlow services={services} />
      </main>
    </div>
  );
}
