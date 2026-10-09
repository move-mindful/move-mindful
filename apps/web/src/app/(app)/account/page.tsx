import { AccountClient } from "@/components/account-client";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-6 pb-12 md:pt-12">
      {/* Not shown on a phone; screen readers still get it. */}
      <h1 className="text-3xl font-bold tracking-tight max-md:sr-only">
        Account Settings
      </h1>
      <div className="md:mt-8">
        <AccountClient />
      </div>
    </div>
  );
}
