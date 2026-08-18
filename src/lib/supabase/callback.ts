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
