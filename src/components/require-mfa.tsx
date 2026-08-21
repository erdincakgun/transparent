import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import supabase from "@/lib/supabase/client";

type Status = "loading" | "enroll" | "verify" | "verified";

export function RequireMfa() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (cancelled) return;

      setStatus(
        error || !data
          ? "enroll"
          : data.currentLevel === "aal2"
            ? "verified"
            : data.nextLevel === "aal2"
              ? "verify"
              : "enroll",
      );
    };

    read();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      setTimeout(read, 0);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return null;

  if (status === "enroll") return <Navigate to="/mfa-enroll" replace />;

  if (status === "verify") return <Navigate to="/mfa-verify" replace />;

  return <Outlet />;
}
