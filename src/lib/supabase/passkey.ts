import type { AuthPasskeyAuthenticationVerifyResponse } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/client";

/**
 * A passkey call can fail on either side of the WebAuthn ceremony: the server
 * refuses the challenge (an `AuthError`, carrying a `code` like
 * `webauthn_verification_failed`) or the browser refuses to run it (a
 * `WebAuthnError`, carrying a `name` like `NotAllowedError`). The union is
 * borrowed off a response type because supabase-js exports the type but not
 * the `WebAuthnError` class itself.
 */
export type PasskeyError = NonNullable<
  AuthPasskeyAuthenticationVerifyResponse["error"]
>;

/**
 * Whether this browser can run a ceremony at all. Unlike a server rule -- which
 * the forms submit into and then translate -- this is a fact about the device
 * that is knowable up front, so the buttons are hidden rather than offered and
 * then failed.
 */
export const passkeysSupported = () =>
  "PublicKeyCredential" in window &&
  typeof navigator.credentials?.create === "function" &&
  typeof navigator.credentials?.get === "function";

/**
 * `list()` unwraps to the passkeys this user has registered. Same shape as
 * `listVerifiedTotpFactors` in `mfa.ts`, and same reason: every caller would
 * otherwise unwrap `{ data, error }` by hand.
 */
export const listPasskeys = async () => {
  const { data, error } = await supabase.auth.passkey.list();

  return { passkeys: data ?? [], error };
};

/**
 * Translated the same way MFA and Postgres errors are: submit first, turn what
 * comes back into copy.
 *
 * | signal | meaning |
 * |---|---|
 * | `NotAllowedError` | the prompt was dismissed, timed out, or offered nothing to pick |
 * | `ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED` | this device already holds a passkey for the account |
 * | `webauthn_credential_exists` | the same, caught by the server instead of the browser |
 * | `webauthn_credential_not_found` | the passkey signs in somewhere, but not here |
 * | `webauthn_challenge_expired` / `webauthn_challenge_not_found` | the ceremony outlived its challenge |
 * | `webauthn_verification_failed` | the signature did not check out |
 * | `too_many_passkeys` | the account is at its passkey limit |
 * | `passkey_disabled` | passkeys are off for this project |
 * | `insufficient_aal` | passkeys are managed at `aal2` only |
 */
export const passkeyErrorMessage = (error: PasskeyError) => {
  // Widened deliberately: GoTrue already sends the passkey codes below, but the
  // `ErrorCode` union in this version of supabase-js does not list them yet, so
  // comparing against the narrow type would not type-check.
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
