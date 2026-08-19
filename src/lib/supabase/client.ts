import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createClient() {
  return createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "pkce",
        // Passkey support is experimental and opt-in: without this flag every
        // `auth.passkey.*` method and `signInWithPasskey`/`registerPasskey`
        // throws rather than returning an error to translate.
        experimental: { passkey: true },
      },
    },
  );
}

const supabase = createClient();
export default supabase;
