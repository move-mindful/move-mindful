import Link from "next/link";
import { DashboardClient } from "@/components/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/classes"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        &larr; Back to classes
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Dashboard</h1>
      <div className="mt-8">
        <DashboardClient />
      </div>
    </div>
  );
}
