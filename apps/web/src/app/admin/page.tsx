import { redirect } from "next/navigation";

// The admin dashboard is temporarily hidden so the /admin slot can be repurposed
// later. For now, Exercises is the default admin landing page. The previous
// dashboard UI is preserved in components/admin/admin-dashboard.tsx.
export default function AdminPage() {
  redirect("/admin/exercises");
}
