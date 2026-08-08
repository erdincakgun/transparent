import { useEffect } from "react";
import Dashboard from "./layouts/dashboard";
import supabase from "./lib/supabase/client";

export default function App() {
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
