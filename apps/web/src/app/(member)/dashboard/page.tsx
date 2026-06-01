import { DashboardClient } from "@/components/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <div className="mt-8">
        <DashboardClient />
      </div>
    </div>
  );
}
