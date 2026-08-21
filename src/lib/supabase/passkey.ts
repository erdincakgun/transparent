import type { AuthPasskeyAuthenticationVerifyResponse } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/client";

export type PasskeyError = NonNullable<
  AuthPasskeyAuthenticationVerifyResponse["error"]
>;

export const passkeysSupported = () =>
  "PublicKeyCredential" in window &&
  typeof navigator.credentials?.create === "function" &&
  typeof navigator.credentials?.get === "function";

export const listPasskeys = async () => {
  const { data, error } = await supabase.auth.passkey.list();

  return { passkeys: data ?? [], error };
};

export const passkeyErrorMessage = (error: PasskeyError) => {
  const code: string | undefined = error.code;

  return error.name === "NotAllowedError"
    ? "That was cancelled or timed out. Try again."
    : code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" ||
        code === "webauthn_credential_exists"
      ? "This device already has a passkey for your account."
      : code === "webauthn_credential_not_found"
        ? "That passkey is not registered here. Sign in with your email instead."
        : code === "webauthn_challenge_expired" ||
            code === "webauthn_challenge_not_found"
          ? "That took too long. Try again."
          : code === "webauthn_verification_failed"
            ? "That passkey could not be verified. Try again."
            : code === "too_many_passkeys"
              ? "You have as many passkeys as an account can hold. Remove one first."
              : code === "passkey_disabled"
                ? "Passkeys are not turned on for this app."
                : code === "insufficient_aal"
                  ? "Enter a code from your authenticator app before managing passkeys."
                  : code === "captcha_failed"
                    ? "Verification failed. Try again."
                    : code === "over_request_rate_limit"
                      ? "Too many attempts. Wait a moment and try again."
                      : error.message;
};
