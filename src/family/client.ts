import { createClient } from "@supabase/supabase-js";
import { cloudFetch } from "./network";
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
      },
      global: { fetch: cloudFetch },
    })
  : null;
export const appUrl = () =>
  new URL(import.meta.env.BASE_URL, location.origin).href;

if (typeof window !== "undefined") {
  const invite = new URL(location.href).searchParams.get("invite");
  if (invite && /^[a-f0-9]{64}$/.test(invite)) {
    localStorage.setItem("eatfirst-invite", invite);
    const u = new URL(location.href);
    u.searchParams.delete("invite");
    u.hash = "Family";
    history.replaceState(null, "", u);
  }
}

if (
  typeof window !== "undefined" &&
  new URL(location.href).searchParams.has("code")
) {
  const u = new URL(location.href);
  u.hash = "Family";
  history.replaceState(null, "", u);
}
