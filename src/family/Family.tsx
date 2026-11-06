import { pendingInvitationKey } from "../preview";
import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Cloud,
  CloudOff,
  Copy,
  ShieldCheck,
  Download,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { supabase, cloudConfigured, appUrl, authCallbackError } from "./client";
import { beginGoogleSignIn, googleDisplayName } from "./oauth";
import { kitchen } from "./store";
import { useKitchen } from "./useKitchen";
import { db, readData } from "../db";
import type { Data } from "../core";
export function downloadJSON(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Member = { user_id: string; display_name: string; role: string };
type Invitation = {
  id: string;
  email: string | null;
  expires_at: string;
  claimed_by: string | null;
  revoked: boolean;
};
export function Family() {
  const state = useKitchen();
  const [message, setMessage] = useState(""),
    [error, setError] = useState(authCallbackError),
    [busy, setBusy] = useState(false),
    [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Invitation[]>([]),
    [link, setLink] = useState(""),
    [invite, setInvite] = useState(
      localStorage.getItem(pendingInvitationKey) ?? "",
    ),
    [confirm, setConfirm] = useState<"migrate" | "conflict" | null>(null),
    [backups, setBackups] = useState<
      { id: string; label: string; date: string; data: Data; owner?: string }[]
    >([]);
  const house = state.household;
  const houseId = house?.id;
  const owner = house?.owner_id === state.session?.user.id;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(
        (e as { message?: string }).message ??
          "Something went wrong. Your data has been kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    if (!supabase || !houseId) {
      setMembers([]);
      setInvites([]);
      return;
    }
    void Promise.all([
      supabase
        .from("household_members")
        .select("user_id,display_name,role")
        .eq("household_id", houseId),
      owner
        ? supabase
            .from("household_invitations")
            .select("id,email,expires_at,claimed_by,revoked")
            .eq("household_id", houseId)
        : Promise.resolve({ data: [], error: null }),
    ]).then(([m, i]) => {
      if (cancelled) return;
      if (m.error || i.error)
        setError(
          m.error?.message ?? i.error?.message ?? "Could not load members",
        );
      else {
        setMembers(m.data ?? []);
        setInvites(i.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [houseId, owner, state.revision, link]);
  useEffect(() => {
    void db.backups
      .orderBy("date")
      .reverse()
      .toArray()
      .then((rows) =>
        setBackups(
          rows.filter((b) => !b.owner || b.owner === state.session?.user.id),
        ),
      );
  }, [message, confirm, state.session?.user.id, state.state]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ONE KITCHEN. EVERYONE IN THE LOOP.</p>
          <h1>A little more together.</h1>
          <p>Your own account. Your family’s shared kitchen.</p>
        </div>
        <Users className="family-heading-icon" size={42} />
      </div>
      {(error || state.error) && (
        <div className="banner danger" role="alert">
          {error || state.error}
        </div>
      )}
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {!cloudConfigured && (
        <div className="banner">
          <ShieldCheck size={20} />
          <p>
            Family sharing is not configured in this build. Your local kitchen
            still works. The project owner needs to finish the Supabase setup.
          </p>
        </div>
      )}
      {!state.session ? (
        <section className="panel padded auth-panel">
          <span className="empty-icon">
            <Users size={29} />
          </span>
          <h2>Welcome to the family kitchen</h2>
          <p className="muted">
            Keep using EatFirst locally, or sign in to share groceries across
            phones. Your existing local food stays on this device until you
            choose to migrate it.
          </p>
          {invite && (
            <div className="banner">
              An invitation is waiting. Sign in with your own account to accept
              it.
            </div>
          )}
          <button
            type="button"
            className="btn google-signin full"
            disabled={busy || !cloudConfigured}
            onClick={() =>
              void run(() => beginGoogleSignIn(supabase, appUrl()))
            }
          >
            <svg aria-hidden="true" viewBox="0 0 48 48" width="22" height="22">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
              />
            </svg>
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <p className="muted small">
            Use your own Google account. No EatFirst password or email signup
            needed. Google handles account verification and recovery.
          </p>
          <div className="auth-reassurance">
            <ShieldCheck size={19} aria-hidden="true" />
            <span>
              Only your name, email and profile photo. No access to Gmail or
              Google Drive.
            </span>
          </div>
          <p className="muted small">
            Shared kitchens are private to their members. You choose whether to
            bring your local groceries into a household after signing in.
          </p>
        </section>
      ) : (
        <>
          <div className="family-account panel padded">
            <div>
              <p className="eyebrow">SIGNED IN AS</p>
              <strong>{state.session.user.email}</strong>
              <p className="muted small">
                Local kitchen and family kitchen are kept separately.
              </p>
            </div>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await kitchen.logout();
                  setMessage(
                    "Signed out on this device. Your local kitchen is still available.",
                  );
                })
              }
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
          <section className="panel padded">
            <h2>Your kitchens</h2>
            <label>
              Active kitchen
              <select
                aria-label="Active kitchen"
                value={house?.id ?? ""}
                disabled={busy}
                onChange={(e) =>
                  run(async () => {
                    await kitchen.select(e.target.value || undefined);
                  })
                }
              >
                <option value="">On this device · local kitchen</option>
                {state.households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => run(() => kitchen.loadHouseholds())}
            >
              <RefreshCw size={16} />
              Refresh memberships
            </button>
            {house && (
              <div className={`sync-status ${state.state}`} role="status">
                {state.state === "offline" ? (
                  <CloudOff size={21} />
                ) : (
                  <Cloud size={21} />
                )}
                <div>
                  <strong>
                    {state.state === "synced"
                      ? "Up to date"
                      : state.state === "conflict"
                        ? "An edit needs your attention"
                        : state.state === "offline"
                          ? "Offline · changes kept here"
                          : state.state === "locked"
                            ? "Household access unavailable"
                            : state.state === "error"
                              ? "Sync needs attention"
                              : "Synchronizing…"}
                  </strong>
                  <small>
                    {state.pending} pending change
                    {state.pending !== 1 ? "s" : ""}.{" "}
                    {state.state === "synced"
                      ? "Shared changes are synchronized."
                      : "Keep this device’s data until synchronization finishes."}
                  </small>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Retry synchronization"
                  onClick={() => kitchen.requestSync()}
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            )}
            {state.state === "locked" && state.pending > 0 && (
              <div className="banner">
                <p>
                  Your pending edits remain on this device. Export them before
                  switching kitchens or clearing browser data.
                </p>
                <button
                  onClick={() => {
                    const proposal = kitchen.pendingProposal();
                    if (proposal)
                      downloadJSON(
                        proposal,
                        "eatfirst-revoked-access-pending-proposal.json",
                      );
                  }}
                >
                  Export retained pending changes
                </button>
              </div>
            )}
            {(state.conflict ||
              (state.state === "error" && state.pending > 0)) && (
              <div className="conflict-box">
                <h3>Two people edited the same record</h3>
                <p>
                  Your queued proposal is still on this device. To continue,
                  export it or keep the shared version. Keeping the shared
                  version saves your entire proposal in local backups first.
                  Later queued edits are included in that backup for manual
                  re-entry.
                </p>
                <code>
                  {state.conflict?.table ?? "pending updates"}:{" "}
                  {state.conflict?.key ?? "Review your retained proposal"}
                </code>
                <div className="button-stack">
                  <button
                    className="btn secondary"
                    onClick={() =>
                      downloadJSON(state.data, "eatfirst-pending-proposal.json")
                    }
                  >
                    <Download size={17} />
                    Export pending proposal
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => setConfirm("conflict")}
                  >
                    Keep shared version & preserve proposal
                  </button>
                </div>
              </div>
            )}
          </section>
          <div className="settings-grid">
            <section className="panel padded">
              <h2>Create a household</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void run(() =>
                    kitchen.create(
                      String(fd.get("house")),
                      String(fd.get("name")),
                    ),
                  );
                }}
              >
                <label>
                  Household name
                  <input
                    name="house"
                    placeholder="e.g. The family kitchen"
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Your display name
                  <input
                    name="name"
                    defaultValue={String(
                      googleDisplayName(state.session.user.user_metadata),
                    )}
                    required
                    maxLength={80}
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Create household
                </button>
              </form>
            </section>
            <section className="panel padded">
              <h2>Join your family</h2>
              <p className="muted">
                Open an invitation link on this phone, or paste the 64-character
                token from its URL.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void run(async () => {
                    await kitchen.accept(invite, String(fd.get("name")));
                    setInvite("");
                    setMessage(
                      "You’ve joined the household. Your family’s kitchen is loading.",
                    );
                  });
                }}
              >
                <label>
                  Invitation token
                  <input
                    aria-label="Invitation token"
                    value={invite}
                    onChange={(e) => setInvite(e.target.value.trim())}
                    pattern="[a-f0-9]{64}"
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  Your display name
                  <input
                    name="name"
                    defaultValue={String(
                      googleDisplayName(state.session.user.user_metadata),
                    )}
                    maxLength={80}
                    required
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Accept invitation
                </button>
              </form>
            </section>
          </div>
          {house && (
            <>
              <section className="panel padded">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">YOUR HOUSEHOLD</p>
                    <h2>{house.name}</h2>
                  </div>
                  <span className="badge">{owner ? "Owner" : "Member"}</span>
                </div>
                <div className="family-members">
                  {members.map((m) => (
                    <div className="member-row" key={m.user_id}>
                      <span className="member-avatar">
                        <Users size={18} />
                      </span>
                      <div>
                        <strong>{m.display_name}</strong>
                        <small>
                          {m.role}
                          {m.user_id === state.session?.user.id ? " · you" : ""}
                        </small>
                      </div>
                      {owner && m.role !== "owner" && (
                        <button
                          className="text-btn error-text"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${m.display_name} from this household? They will lose online access. Existing offline copies cannot be remotely erased.`,
                              )
                            )
                              void run(async () => {
                                const { error } = await supabase!.rpc(
                                  "manage_household",
                                  {
                                    h: house.id,
                                    command: "remove",
                                    target: m.user_id,
                                  },
                                );
                                if (error) throw error;
                                kitchen.requestSync();
                                setMessage("Member removed.");
                              });
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {owner ? (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        void run(async () => {
                          const { error } = await supabase!.rpc(
                            "manage_household",
                            {
                              h: house.id,
                              command: "rename",
                              new_name: String(fd.get("name")),
                            },
                          );
                          if (error) throw error;
                          kitchen.requestSync();
                          await kitchen.loadHouseholds();
                        });
                      }}
                    >
                      <label>
                        Household name
                        <input
                          name="name"
                          defaultValue={house.name}
                          key={house.name}
                          maxLength={80}
                          required
                        />
                      </label>
                      <button className="btn secondary" disabled={busy}>
                        Save household name
                      </button>
                    </form>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        void run(async () => {
                          const { data, error } = await supabase!.rpc(
                            "create_invitation",
                            {
                              h: house.id,
                              target_email:
                                String(fd.get("email")).trim() || null,
                            },
                          );
                          if (error) throw error;
                          const u = new URL(appUrl());
                          u.searchParams.set("invite", data.token);
                          u.hash = "Family";
                          setLink(u.href);
                          kitchen.requestSync();
                          setMessage(
                            "Private invitation created. It expires in 48 hours and can be used once.",
                          );
                        });
                      }}
                    >
                      <h3>Invite someone to the table</h3>
                      <label>
                        Restrict to email (recommended, optional)
                        <input
                          name="email"
                          type="email"
                          maxLength={254}
                          placeholder="family@example.com"
                        />
                      </label>
                      <button className="btn primary" disabled={busy}>
                        <UserPlus size={17} />
                        Create invitation link
                      </button>
                    </form>
                    {link && (
                      <div className="invite-result">
                        <label>
                          Share this private link
                          <input readOnly value={link} />
                        </label>
                        <button
                          className="btn secondary"
                          onClick={() =>
                            run(async () => {
                              await navigator.clipboard.writeText(link);
                              setMessage(
                                "Invitation copied. Share it privately with your family member.",
                              );
                            })
                          }
                        >
                          <Copy size={17} />
                          Copy invitation
                        </button>
                        <p className="muted small">
                          Anyone who holds an unrestricted invitation can join.
                          Share privately. The link is shown only on this device
                          after creation.
                        </p>
                      </div>
                    )}
                    <div>
                      {invites
                        .filter((i) => !i.claimed_by && !i.revoked)
                        .map((i) => (
                          <div className="member-row" key={i.id}>
                            <div>
                              <strong>
                                {i.email ?? "Anyone with the private link"}
                              </strong>
                              <small>
                                Expires{" "}
                                {new Date(i.expires_at).toLocaleString()}
                              </small>
                            </div>
                            <button
                              className="text-btn"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const { error } = await supabase!.rpc(
                                    "manage_household",
                                    {
                                      h: house.id,
                                      command: "revoke",
                                      target: i.id,
                                    },
                                  );
                                  if (error) throw error;
                                  kitchen.requestSync();
                                })
                              }
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <button
                    className="btn danger-outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Leave this household? Your private cached copy will remain on this device, but you will lose online access.",
                        )
                      )
                        void run(async () => {
                          const { error } = await supabase!.rpc(
                            "manage_household",
                            { h: house.id, command: "leave" },
                          );
                          if (error) throw error;
                          await kitchen.select();
                          await kitchen.loadHouseholds();
                        });
                    }}
                  >
                    Leave household
                  </button>
                )}
              </section>
              <section className="panel padded">
                <h2>Bring your local kitchen along</h2>
                <p>
                  Your original local groceries, shopping list and history stay
                  intact. A confirmed migration adds them to this household,
                  skips identical IDs and duplicate active shopping names, and
                  keeps a dated local backup. Different records with the same ID
                  block migration for review. Pantry settings remain the
                  household’s.
                </p>
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    state.migrated ||
                    state.pending > 0 ||
                    state.state !== "synced"
                  }
                  onClick={() => setConfirm("migrate")}
                >
                  {state.migrated
                    ? "Local kitchen already imported"
                    : "Review local migration"}
                </button>
                <button
                  className="btn secondary"
                  onClick={() =>
                    run(async () =>
                      downloadJSON(
                        await readData(),
                        "eatfirst-original-local-kitchen.json",
                      ),
                    )
                  }
                >
                  <Download size={17} />
                  Export original local kitchen
                </button>
              </section>
            </>
          )}
        </>
      )}
      {confirm && (
        <section
          className="panel padded confirm-inline"
          role="alertdialog"
          aria-label={
            confirm === "migrate"
              ? "Confirm local migration"
              : "Confirm conflict resolution"
          }
        >
          <h2>
            {confirm === "migrate"
              ? "Add this device’s kitchen to your household?"
              : "Keep the shared version?"}
          </h2>
          <p>
            {confirm === "migrate"
              ? "This is a one-time, confirmed import into the selected household. Your original local kitchen remains untouched and a backup is kept before queuing changes."
              : "All pending proposals are preserved in a local backup and conflict archive first. The latest shared records will then replace the queued view. Re-enter any intended changes from your backup."}
          </p>
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (confirm === "migrate") await kitchen.migrate();
                  else await kitchen.resolveConflict();
                  setConfirm(null);
                  setMessage(
                    "Backup preserved. Your kitchen is synchronizing.",
                  );
                })
              }
            >
              Confirm
            </button>
          </div>
        </section>
      )}
      <section className="panel padded">
        <h2>Preserved local backups</h2>
        <p className="muted">
          These never leave this browser unless you export them. Browser storage
          clearing can remove them; download important backups.
        </p>
        {backups.length ? (
          backups.map((b) => (
            <div className="member-row" key={b.id}>
              <div>
                <strong>{b.label}</strong>
                <small>{new Date(b.date).toLocaleString()}</small>
              </div>
              <button
                className="icon-btn"
                aria-label={`Download ${b.label}`}
                onClick={() =>
                  downloadJSON(b.data, `eatfirst-preserved-${b.id}.json`)
                }
              >
                <Download size={18} />
              </button>
            </div>
          ))
        ) : (
          <p className="muted">
            Backups will appear before migration, conflict resolution and backup
            replacement.
          </p>
        )}
      </section>
      <div className="safety-note">
        <ShieldCheck size={20} />
        <p>
          Family data is stored in Supabase and private caches on your devices.
          Household membership is enforced in the database. Devices may retain
          downloaded data offline after membership is revoked. Use trusted
          browser profiles and sign out on shared devices. Changes may take a
          moment to synchronize after reconnecting.
        </p>
      </div>
    </>
  );
}
