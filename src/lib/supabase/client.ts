import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router";

export function createClient() {
  return createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  );
}

export function signOut() {
  const supabase = createClient();
  const navigate = useNavigate();
  supabase.auth.signOut();
  navigate("/login");
}
