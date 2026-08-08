import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Dashboard from "./layouts/dashboard";

export default function AuthenticatedRoute() {
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { error } = await supabase.auth.getUser();

      if (error) {
        location.href = "/login";
      }
    };

    checkAuth();
  }, []);

  return <Dashboard></Dashboard>;
}
