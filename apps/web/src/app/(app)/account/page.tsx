import { AccountClient } from "@/components/account-client";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Account Settings
      </h1>
      <div className="mt-8">
        <AccountClient />
      </div>
    </div>
  );
}
