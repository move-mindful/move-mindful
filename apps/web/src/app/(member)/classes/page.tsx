import { getBrowseRows } from "@/lib/collections";
import { CollectionCarousel } from "@/components/collection-carousel";

export default async function ClassesPage() {
  const rows = await getBrowseRows();

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
        <p className="mt-3 text-zinc-500">No classes available yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
      <div className="mt-8 space-y-10">
        {rows.map((row) => (
          <CollectionCarousel key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
