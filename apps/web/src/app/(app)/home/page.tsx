/**
 * The signed-in root — where every entry point lands (see MEMBER_HOME in
 * lib/routes.ts). Distinct from "/", which is the public marketing page.
 *
 * Deliberately a holding page for now. This is where the list of what a person
 * owns goes: free products, the one-time video series, and the class library
 * once the membership launches.
 */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Home</h1>
      <p className="mt-3 text-zinc-500">
        Your videos will appear here. Nothing to show just yet — check back soon.
      </p>
    </div>
  );
}
