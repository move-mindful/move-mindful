import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getBrowseRows } from "@/lib/collections";
import { CollectionCarousel } from "@/components/collection-carousel";

export default async function ClassesPage() {
  await requireSectionUnlocked();

  const rows = await getBrowseRows();

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-6 pb-12 md:pt-12">
        <p className="text-zinc-500 dark:text-zinc-400">No classes available yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-6 pb-12 md:pt-12">
      <div className="space-y-10">
        {rows.map((row) => (
          <CollectionCarousel key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
