/**
 * The magic link comes back to `VITE_SITE_URL` carrying either `?code=…` — the
 * PKCE authorization code — or `?error=…&error_code=…` when GoTrue refused the
 * link outright. supabase-js redeems the code while the client initialises and
 * hands any failure to its own caller rather than to us, so a sign-in that
 * fails here reaches the app as nothing more than "no session", and the user
 * lands back on the login screen with no idea why.
 *
 * It does leave a trace. `_getSessionFromURL` throws above the
 * `history.replaceState` that strips `code`, so on failure the query string
 * survives; `RequireAuth` then carries it across in the router state it already
 * sets (`state={{ from: location }}`). That is what lets the login screen tell
 * a link that could not be redeemed from a plain visit.
 *
 * The `code` case is the one that will actually happen. PKCE keeps its verifier
 * in the localStorage of the browser that asked for the link, so a link opened
 * anywhere else cannot be redeemed — and signing in here needs a TOTP code,
 * which makes "ask on the laptop, open the mail on the phone" the normal thing
 * to do rather than the edge case.
 */
export const callbackMessage = (search: string | undefined) => {
  if (!search) return undefined;

  const params = new URLSearchParams(search);
  const errorCode = params.get("error_code") ?? params.get("error");

  if (errorCode === "otp_expired")
    return "That link has expired. Enter your email below and we will send you a new one.";

  if (errorCode)
    return "That link is no longer valid. Enter your email below and we will send you a new one.";

  if (params.has("code"))
    return "This link only works on the device and in the browser where you asked for it. Enter your email below to get a new link for this device.";

  return undefined;
};
