/* global process, console, URL */
import { Buffer } from "node:buffer";
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key)
  throw Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY repository secret.",
  );
const parsed = new URL(url);
if (
  parsed.protocol !== "https:" ||
  parsed.pathname !== "/" ||
  parsed.search ||
  parsed.hash ||
  parsed.username ||
  parsed.password
)
  throw Error("Supabase URL must be the HTTPS project root without /rest/v1/.");
let safe = key.startsWith("sb_publishable_");
if (!safe && key.split(".").length === 3) {
  try {
    safe =
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role === "anon";
  } catch {
    safe = false;
  }
}
if (!safe)
  throw Error(
    "Use a publishable or legacy anon key. Never use a secret/service-role key in frontend configuration.",
  );
console.log("Supabase frontend configuration validated (values not printed).");
