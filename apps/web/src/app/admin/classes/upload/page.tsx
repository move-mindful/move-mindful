import Link from "next/link";
import { BatchUpload } from "@/components/admin/batch-upload";

export const dynamic = "force-dynamic";

export default function UploadClassesPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Classes
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Upload</h1>
      <p className="mt-1 text-zinc-500">
        Pick several video files at once and upload them straight to Mux. When Mux
        finishes encoding, they appear in{" "}
        <Link href="/admin/classes/import" className="underline hover:text-zinc-700">
          Import
        </Link>
        , where you turn each one into a class.
      </p>
      <div className="mt-8">
        <BatchUpload />
      </div>
    </div>
  );
}
