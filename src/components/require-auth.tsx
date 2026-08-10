import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import supabase from "@/lib/supabase/client";

type Status = "loading" | "authenticated" | "anonymous";

export function RequireAuth() {
  const location = useLocation();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        await supabase.auth.signOut();
        setStatus("anonymous");
      } else {
        setStatus("authenticated");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setStatus(session ? "authenticated" : "anonymous");
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (status === "loading") return null;

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
