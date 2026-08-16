import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import supabase from "@/lib/supabase/client";

type Status = "loading" | "enroll" | "verify" | "verified";

/**
 * The assurance-level gate. `is_mfa_verified()` already refuses every row to a
 * session that is not `aal2`, so this only decides which screen the user sees
 * on the way there — never whether their data is safe.
 *
 * | currentLevel | nextLevel | status |
 * |---|---|---|
 * | `aal1` | `aal1` | no factor enrolled yet |
 * | `aal1` | `aal2` | factor enrolled, this session not elevated |
 * | `aal2` | `aal2` | elevated |
 */
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
      // supabase-js holds its session lock for the duration of this callback,
      // so the re-read has to wait until the callback has returned
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
