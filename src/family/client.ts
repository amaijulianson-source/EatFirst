import { releasePreview, pendingInvitationKey } from "../preview";
import { createClient } from "@supabase/supabase-js";
import { cloudFetch } from "./network";
import { callbackState } from "./oauth";

const callback =
  typeof window !== "undefined" ? callbackState(location.href) : null;
export const authCallbackError = callback?.error ?? "";
if (callback && (callback.invite || callback.callback)) {
  if (callback.invite)
    localStorage.setItem(pendingInvitationKey, callback.invite);
  const u = new URL(location.href);
  u.searchParams.delete("invite");
  if (callback.error) {
    for (const key of ["error", "error_description", "error_code"])
      u.searchParams.delete(key);
  }
  u.hash = "Family";
  history.replaceState(null, "", u);
}

const url = import.meta.env.VITE_SUPABASE_URL?.replace(
  /\/rest\/v1\/?$/,
  "",
).replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = Boolean(url && key);
export const supabase = cloudConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        ...(releasePreview ? { storageKey: "eatfirst-v2-preview-auth" } : {}),
      },
      global: { fetch: cloudFetch },
    })
  : null;
export const appUrl = () =>
  new URL(import.meta.env.BASE_URL, location.origin).href;
