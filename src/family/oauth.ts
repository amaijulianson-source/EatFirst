import type { SupabaseClient } from "@supabase/supabase-js";

export async function beginGoogleSignIn(
  client: SupabaseClient | null,
  redirectTo: string,
) {
  if (!client) throw Error("Family sharing is not configured in this build.");
  if (!navigator.onLine)
    throw Error(
      "Connect to the internet to sign in. Your local kitchen still works offline.",
    );
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Let each family member choose their own account on shared devices.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export function googleDisplayName(metadata: Record<string, unknown>): string {
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim())
      return value.trim().slice(0, 80);
  }
  return "";
}

export function callbackState(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const error = url.searchParams.get("error") ?? hash.get("error");
  const invite = url.searchParams.get("invite");
  return {
    invite: invite && /^[a-f0-9]{64}$/.test(invite) ? invite : null,
    callback: url.searchParams.has("code") || Boolean(error),
    // Do not display raw provider errors, URLs or tokens supplied in the URL.
    error: error
      ? error === "access_denied"
        ? "Google sign-in was cancelled or denied. You can try again; your local data is unchanged."
        : "Google sign-in could not finish. Try again in the same browser where you started."
      : "",
  };
}
