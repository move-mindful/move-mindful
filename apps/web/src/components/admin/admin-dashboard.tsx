// Temporarily unused. The admin dashboard route (/admin) is hidden — it now
// redirects to /admin/classes (see app/admin/page.tsx), and Classes is the
// default admin landing page. This component preserves the original dashboard
// UI so it can be brought back (re-route it from app/admin/page.tsx) or the
// /admin slot can be repurposed later.

import Link from "next/link";

const sections = [
  {
    href: "/admin/classes",
    title: "Classes",
    description: "Sync videos from Mux, edit details, publish, and organize the library.",
  },
  {
    href: "/admin/tags",
    title: "Tags",
    description: "Manage the tag groups and tags used to label and filter classes.",
  },
  {
    href: "/admin/collections",
    title: "Collections",
    description: "Build the curated and smart collections members browse.",
  },
];

export function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
      <p className="mt-2 text-zinc-500">Manage the Move Mindful content library.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:shadow-md"
          >
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
