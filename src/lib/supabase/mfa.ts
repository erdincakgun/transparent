import type { AuthError, Factor } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/client";

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

export const listVerifiedTotpFactors = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();

  return { factors: (data?.totp ?? []) as Factor<"totp", "verified">[], error };
};

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

export const mfaErrorMessage = (error: AuthError) =>
  error.code === "mfa_verification_failed"
    ? "That code is not right. Enter the next one from your app."
    : error.code === "mfa_challenge_expired"
      ? "That code expired. Enter the next one from your app."
      : error.code === "over_request_rate_limit"
        ? "Too many attempts. Wait a moment and try again."
        : error.message;
