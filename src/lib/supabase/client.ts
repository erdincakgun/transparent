import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createClient() {
  return createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "pkce",
        experimental: { passkey: true },
      },
    },
  );
}

const supabase = createClient();
export default supabase;
