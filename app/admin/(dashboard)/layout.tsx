import { AdminLayout } from "@/components/admin/AdminLayout";

// All admin pages use Supabase client — must be dynamic
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
