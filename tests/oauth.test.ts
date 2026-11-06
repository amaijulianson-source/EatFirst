import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  beginGoogleSignIn,
  callbackState,
  googleDisplayName,
} from "../src/family/oauth";

describe("Google sign-in", () => {
  it("uses the exact Pages path and account chooser without extra Google scopes", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
    await beginGoogleSignIn(
      { auth: { signInWithOAuth } } as unknown as SupabaseClient,
      "https://amaijulianson-source.github.io/EatFirst/",
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://amaijulianson-source.github.io/EatFirst/",
        queryParams: { prompt: "select_account" },
      },
    });
    vi.unstubAllGlobals();
  });
  it("reports unavailable configuration, offline login, and SDK errors", async () => {
    await expect(
      beginGoogleSignIn(null, "https://example.com/"),
    ).rejects.toThrow("not configured");
    vi.stubGlobal("navigator", { onLine: false });
    const fn = vi.fn();
    const client = {
      auth: { signInWithOAuth: fn },
    } as unknown as SupabaseClient;
    await expect(
      beginGoogleSignIn(client, "https://example.com/"),
    ).rejects.toThrow("internet");
    expect(fn).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { onLine: true });
    fn.mockResolvedValue({ error: Error("Provider unavailable") });
    await expect(
      beginGoogleSignIn(client, "https://example.com/"),
    ).rejects.toThrow("Provider unavailable");
    vi.unstubAllGlobals();
  });
  it("recognizes a PKCE callback and preserves a valid invitation", () => {
    const state = callbackState(
      `https://example.com/EatFirst/?code=one-use-code&invite=${"a".repeat(64)}`,
    );
    expect(state.callback).toBe(true);
    expect(state.invite).toBe("a".repeat(64));
    expect(state.error).toBe("");
    expect(callbackState("https://example.com/?invite=bad").invite).toBeNull();
  });
  it("handles provider cancellation in query or fragment without reflecting unsafe details", () => {
    expect(
      callbackState(
        "https://example.com/#error=access_denied&error_description=secret",
      ).error,
    ).toMatch(/cancelled/);
    const state = callbackState(
      "https://example.com/?error=unexpected&error_description=secret",
    );
    expect(state.callback).toBe(true);
    expect(state.error).not.toContain("secret");
    expect(state.error).toMatch(/same browser/);
  });
  it("accepts Google metadata while retaining existing family display names", () => {
    expect(googleDisplayName({ full_name: " Jane Doe " })).toBe("Jane Doe");
    expect(
      googleDisplayName({ display_name: "Parent", full_name: "Jane" }),
    ).toBe("Parent");
    expect(googleDisplayName({ name: "Child" })).toBe("Child");
    expect(googleDisplayName({ full_name: {} })).toBe("");
  });
});
