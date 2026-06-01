import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service-role key. It bypasses RLS, so it must only
 * ever run on the server behind an admin gate (see requireAdmin). The
 * `server-only` import above makes an accidental import from a Client Component
 * fail the build, keeping SUPABASE_SERVICE_ROLE_KEY off the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
