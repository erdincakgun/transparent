import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { KeyRoundIcon } from "lucide-react";
import supabase from "@/lib/supabase/client";
import {
  listPasskeys,
  passkeyErrorMessage,
  passkeysSupported,
} from "@/lib/supabase/passkey";
import type { PasskeyListItem } from "@supabase/supabase-js";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Passkeys are how you get *in*; the authenticator app is what unlocks the
 * data once you are. GoTrue enforces the same split from its side -- managing
 * passkeys is an `aal2`-only operation when MFA is enabled -- which is why this
 * screen sits behind `RequireMfa` beside `/mfa-settings` rather than anywhere a
 * half-signed-in session could reach.
 */
export function PasskeySettingsForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string>();
  const [error, setError] = useState<string>();
  // Read once for the same reason the sign-in button reads it: a browser with
  // no WebAuthn can still list and remove passkeys made elsewhere, it just
  // cannot make one here.
  const [canAdd] = useState(passkeysSupported);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { passkeys, error } = await listPasskeys();

      if (cancelled) return;

      setPasskeys(passkeys);
      setError(error ? passkeyErrorMessage(error) : undefined);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPasskeys = async () => {
    const { passkeys, error } = await listPasskeys();

    setPasskeys(passkeys);
    setError(error ? passkeyErrorMessage(error) : undefined);
  };

  async function handleAdd() {
    setBusy(true);
    setError(undefined);

    const { error } = await supabase.auth.registerPasskey();

    if (error) {
      setBusy(false);
      setError(passkeyErrorMessage(error));
      return;
    }

    await refreshPasskeys();
    setBusy(false);
  }

  async function handleRemove(passkeyId: string) {
    setBusy(true);
    setError(undefined);

    const { error } = await supabase.auth.passkey.delete({ passkeyId });

    if (error) {
      setBusy(false);
      setError(passkeyErrorMessage(error));
      return;
    }

    await refreshPasskeys();
    setBusy(false);
  }

  async function handleRename(
    passkeyId: string,
    e: { preventDefault: () => void; target: any },
  ) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const friendlyName = formData.get("name")?.toString().trim() ?? "";

    setBusy(true);
    setError(undefined);

    const { error } = await supabase.auth.passkey.update({
      passkeyId,
      friendlyName,
    });

    if (error) {
      setBusy(false);
      setError(passkeyErrorMessage(error));
      return;
    }

    await refreshPasskeys();
    setRenamingId(undefined);
    setBusy(false);
  }

  if (loading) return null;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <Field>
          <p className="text-center text-sm text-muted-foreground">
            Sign in with a passkey instead of waiting for an email. You will
            still be asked for a code from your authenticator app.
          </p>
        </Field>
        {error ? (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        ) : null}
        {passkeys.map((passkey) =>
          renamingId === passkey.id ? (
            <form
              key={passkey.id}
              onSubmit={(e) => handleRename(passkey.id, e)}
            >
              <FieldGroup>
                <Field>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    maxLength={120}
                    defaultValue={passkey.friendly_name ?? ""}
                    placeholder="Name this passkey"
                    required
                    autoFocus
                  />
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" size="sm" disabled={busy}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRenamingId(undefined)}
                  >
                    Cancel
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          ) : (
            <Field key={passkey.id} orientation="horizontal">
              {/* The name is whatever the authenticator calls itself, so it can
                  be long ("Google Password Manager"). `FieldTitle` ships
                  `w-fit flex`, which sizes to the text and leaves `truncate`
                  nothing to clip against -- at 320px the name then runs under
                  the buttons. Bounding it and refusing to shrink the buttons is
                  the same split the list rows use. */}
              <FieldContent className="min-w-0">
                <FieldTitle className="block w-full truncate">
                  {passkey.friendly_name ?? "Passkey"}
                </FieldTitle>
                <FieldDescription>
                  {passkey.last_used_at
                    ? `Last used ${dateFormat.format(new Date(passkey.last_used_at))}`
                    : `Added ${dateFormat.format(new Date(passkey.created_at))}`}
                </FieldDescription>
              </FieldContent>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 max-sm:h-9"
                disabled={busy}
                onClick={() => setRenamingId(passkey.id)}
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="shrink-0 max-sm:h-9"
                disabled={busy}
                onClick={() => handleRemove(passkey.id)}
              >
                Remove
              </Button>
            </Field>
          ),
        )}
        {passkeys.length ? null : (
          <Field>
            <FieldDescription>
              You have no passkeys yet. Add one on each device you sign in
              from — a passkey lives on the device that made it.
            </FieldDescription>
          </Field>
        )}
        {canAdd ? (
          <Field>
            <Button type="button" disabled={busy} onClick={handleAdd}>
              <KeyRoundIcon />
              Add a passkey
            </Button>
          </Field>
        ) : (
          <Field>
            <FieldDescription>
              This browser cannot create passkeys. Any you made elsewhere are
              listed above.
            </FieldDescription>
          </Field>
        )}
        <Field>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Field>
      </FieldGroup>
    </div>
  );
}
