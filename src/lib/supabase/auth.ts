import type { AuthError } from "@supabase/supabase-js";

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
