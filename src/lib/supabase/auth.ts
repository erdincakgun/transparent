import type { AuthError } from "@supabase/supabase-js";

/**
 * Auth errors from `signInWithOtp` are translated the same way MFA and
 * Postgres errors are elsewhere: submit first, turn the code the server
 * sends back into copy.
 *
 * | code | meaning |
 * |---|---|
 * | `captcha_failed` | the Turnstile token was missing, invalid, or expired |
 * | `over_email_send_rate_limit` | too many magic links requested for this address |
 * | `over_request_rate_limit` | too many attempts from this address |
 * | `email_address_invalid` | the address is not a valid email |
 * | `email_address_not_authorized` | this address is blocked from signing in |
 */
export const otpErrorMessage = (error: AuthError) =>
  error.code === "captcha_failed"
    ? "Verification failed. Try again."
    : error.code === "over_email_send_rate_limit"
      ? "Too many requests for this address. Wait a moment and try again."
      : error.code === "over_request_rate_limit"
        ? "Too many attempts. Wait a moment and try again."
        : error.code === "email_address_invalid"
          ? "Enter a valid email address."
          : error.code === "email_address_not_authorized"
            ? "This email address cannot sign in."
            : error.message;
