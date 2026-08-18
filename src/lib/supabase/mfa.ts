import type { AuthError, Factor } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/client";

/**
 * A code is always checked in two calls: `challenge` opens a window the code is
 * valid in, `verify` spends it. Both the enrollment screen and the sign-in
 * screen do exactly this, so they share it. Returns the `AuthError` to
 * translate, or `null` when the session has been raised to `aal2`.
 */
export const verifyMfaCode = async (factorId: string, code: string) => {
  const challenge = await supabase.auth.mfa.challenge({ factorId });

  if (challenge.error) return challenge.error;

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });

  return error;
};

/**
 * `listFactors().data.totp` already lists verified factors only, but every
 * caller still has to unwrap `{ data, error }` the same way -- centralised so
 * a factor list can be requested from more than the two original screens.
 */
export const listVerifiedTotpFactors = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();

  return { factors: (data?.totp ?? []) as Factor<"totp", "verified">[], error };
};

/**
 * A user may hold more than one verified TOTP factor (a primary and a
 * backup), so a code has to be tried against each until one accepts it.
 * Stops early on a rate limit instead of burning the remaining attempts.
 */
export const verifyMfaCodeAnyFactor = async (
  factorIds: string[],
  code: string,
) => {
  let lastError: AuthError | null = null;

  for (const factorId of factorIds) {
    const error = await verifyMfaCode(factorId, code);

    if (!error) return null;
    if (error.code === "over_request_rate_limit") return error;

    lastError = error;
  }

  return lastError;
};

/**
 * Auth errors are translated the same way Postgres errors are on the data
 * forms: submit first, turn the code the server sends back into copy.
 *
 * | code | meaning |
 * |---|---|
 * | `mfa_verification_failed` | the six digits do not match the factor |
 * | `mfa_challenge_expired` | the code was entered after its 30s interval |
 * | `over_request_rate_limit` | too many attempts from this address |
 */
export const mfaErrorMessage = (error: AuthError) =>
  error.code === "mfa_verification_failed"
    ? "That code is not right. Enter the next one from your app."
    : error.code === "mfa_challenge_expired"
      ? "That code expired. Enter the next one from your app."
      : error.code === "over_request_rate_limit"
        ? "Too many attempts. Wait a moment and try again."
        : error.message;
