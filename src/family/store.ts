import { pendingInvitationKey } from "../preview";
import type { Session, RealtimeChannel } from "@supabase/supabase-js";
import { db, readData, saveData, preserveBackup } from "../db";
import { emptyData, validateBackup, type Data } from "../core";
import { supabase } from "./client";
import {
  diff,
  overlay,
  fromSnapshot,
  mergeLocal,
  type ScopeCache,
  type Operation,
} from "./changes";
export type Household = { id: string; name: string; owner_id: string };
export type FamilyView = {
  data: Data | null;
  session: Session | null;
  households: Household[];
  household?: Household;
  state:
    | "local"
    | "syncing"
    | "synced"
    | "offline"
    | "conflict"
    | "error"
    | "locked";
  pending: number;
  error: string;
  revision: number;
  conflict?: ScopeCache["conflict"];
  readOnly?: boolean;
  recovery?: boolean;
  migrated?: boolean;
};
class KitchenStore {
  private view: FamilyView = {
    data: null,
    session: null,
    households: [],
    state: "local",
    pending: 0,
    error: "",
    revision: 0,
  };
  private listeners = new Set<() => void>();
  private started = false;
  private chain = Promise.resolve();
  private channel?: RealtimeChannel;
  private timer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private cache?: ScopeCache;
  getSnapshot = () => this.view;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private emit(patch: Partial<FamilyView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((f) => f());
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.chain.then(fn);
    this.chain = p.then(
      () => {},
      () => {},
    );
    return p;
  }
  async start() {
    if (this.started) return;
    this.started = true;
    if (navigator.locks)
      await new Promise<void>((resolve) => {
        void navigator.locks.request(
          "eatfirst-v2-editor",
          { ifAvailable: true },
          (lock) => {
            this.emit({ readOnly: !lock });
            resolve();
            if (lock) return new Promise<void>(() => {});
          },
        );
      });
    try {
      this.emit({ data: await readData() });
    } catch {
      this.emit({ error: "Local storage could not be opened." });
      return;
    }
    window.addEventListener("online", () => this.requestSync());
    window.addEventListener("offline", () => {
      if (this.view.household) this.emit({ state: "offline" });
    });
    window.addEventListener("focus", () => this.requestSync());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.requestSync();
    });
    setInterval(() => {
      if (document.visibilityState === "visible") this.requestSync();
    }, 20000);
    if (supabase) {
      supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === "PASSWORD_RECOVERY") this.emit({ recovery: true });
        queueMicrotask(() => {
          void this.serial(() => this.setSession(session)).catch((e) =>
            this.emit({ state: "error", error: (e as Error).message }),
          );
        });
      });
      const { data, error } = await supabase.auth.getSession();
      if (error) this.emit({ error: error.message });
      else await this.serial(() => this.setSession(data.session));
    }
  }
  private async setSession(session: Session | null) {
    if (this.view.session?.user.id === session?.user.id) {
      this.emit({ session });
      return;
    }
    this.epoch++;
    if (this.channel) {
      void this.channel.unsubscribe();
      this.channel = undefined;
    }
    this.cache = undefined;
    this.emit({
      session,
      households: [],
      household: undefined,
      state: "local",
      pending: 0,
      migrated: false,
      error: "",
      data: await readData(),
    });
    if (session) {
      const cached = await db.caches.get(`households:${session.user.id}`);
      if (Array.isArray(cached?.value))
        this.emit({ households: cached.value as Household[] });
      const saved = await db.caches.get(`active:${session.user.id}`);
      const cachedActive =
        typeof saved?.value === "string" &&
        this.view.households.some((h) => h.id === saved.value);
      if (cachedActive) await this.selectInternal(saved!.value as string);
      if (navigator.onLine) await this.loadHouseholds();
      if (!cachedActive && typeof saved?.value === "string")
        await this.selectInternal(saved.value);
    }
  }
  async loadHouseholds() {
    if (!supabase || !this.view.session || !navigator.onLine) return;
    const { data, error } = await supabase
      .from("households")
      .select("id,name,owner_id")
      .order("created_at")
      .retry(false);
    if (error) {
      this.emit({ error: `Could not load family: ${error.message}` });
      return;
    }
    this.emit({ households: data ?? [] });
    await db.caches.put({
      id: `households:${this.view.session.user.id}`,
      value: data ?? [],
    });
  }
  private scopeKey(h: string) {
    if (!this.view.session) throw Error("Sign in first.");
    return `${this.view.session.user.id}:${h}`;
  }
  async select(h?: string) {
    await this.serial(async () => {
      this.epoch++;
      if (this.channel) {
        void this.channel.unsubscribe();
        this.channel = undefined;
      }
      this.cache = undefined;
      if (!h) {
        this.emit({
          household: undefined,
          state: "local",
          pending: 0,
          conflict: undefined,
          error: "",
          data: await readData(),
        });
        if (this.view.session)
          await db.caches.delete(`active:${this.view.session.user.id}`);
        return;
      }
      await this.selectInternal(h);
    });
    this.requestSync();
  }
  private async selectInternal(h: string) {
    if (!this.view.session) return;
    const house = this.view.households.find((v) => v.id === h);
    if (!house) {
      this.emit({
        error:
          "Household is unavailable. Connect online to check your memberships.",
      });
      return;
    }
    const row = await db.caches.get(this.scopeKey(h));
    this.cache = row?.value as ScopeCache | undefined;
    this.emit({
      household: house,
      data: this.cache?.data ?? emptyData(),
      pending: this.cache?.queue.length ?? 0,
      conflict: this.cache?.conflict,
      migrated: this.cache?.migrated ?? false,
      state: navigator.onLine ? "syncing" : "offline",
      error: "",
    });
    this.channel = supabase!
      .channel(`household:${h}:${this.view.session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "households",
          filter: `id=eq.${h}`,
        },
        () => this.requestSync(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") this.requestSync();
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          this.emit({
            state: "error",
            error:
              "Realtime connection interrupted. Periodic refresh will retry; pending edits stay on this device.",
          });
      });
    await db.caches.put({
      id: `active:${this.view.session.user.id}`,
      value: h,
    });
    this.requestSync();
  }
  requestSync() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.serial(() => this.sync()).catch((e) =>
        this.emit({ state: "error", error: (e as Error).message }),
      );
    }, 120);
  }
  private async persist() {
    if (this.cache)
      await db.caches.put({ id: this.cache.id, value: this.cache });
  }
  async save(next: Data, label = "Kitchen update", base?: Data) {
    return this.serial(async () => {
      if (this.view.readOnly)
        throw Error(
          "Another EatFirst tab is editing on this device. Close it and reload this tab.",
        );
      validateBackup(next);
      if (!this.view.household) {
        await saveData(next);
        this.emit({ data: next });
        return;
      }
      if (this.view.state === "locked")
        throw Error(
          "Household access was revoked. Switch to your local kitchen.",
        );
      if (!this.cache)
        throw Error("Load this household online once before making changes.");
      if (this.cache.conflict)
        throw Error(
          "Resolve the pending conflict in Family before editing further.",
        );
      if (next.demo)
        throw Error("Sample mode is only available in your local kitchen.");
      const changes = diff(base ?? this.cache.data, next);
      const rebased = overlay(this.cache.data, [
        {
          id: "ui-proposal",
          changes,
          created: new Date().toISOString(),
          label,
        },
      ]);
      if (rebased.conflict) {
        await preserveBackup(
          next,
          "Edit proposal — newer shared record detected",
          this.view.session?.user.id,
        );
        throw Error(
          "A record changed while this action was open. Your proposal is preserved in Family backups. Review the current record before trying again.",
        );
      }
      const accepted = {
        ...rebased.data,
        settings: { ...rebased.data.settings, theme: next.settings.theme },
      };
      if (changes.length > 5000)
        throw Error(
          "This change is too large. Import a smaller backup (maximum 5000 record changes).",
        );
      const operation: Operation = {
        id: crypto.randomUUID(),
        changes,
        created: new Date().toISOString(),
        label,
      };
      const updated = {
        ...this.cache,
        data: accepted,
        queue: changes.length
          ? [...this.cache.queue, operation]
          : this.cache.queue,
      };
      await db.caches.put({ id: updated.id, value: updated });
      this.cache = updated;
      this.emit({
        data: accepted,
        pending: this.cache.queue.length,
        state: navigator.onLine ? "syncing" : "offline",
        error: "",
      });
      this.requestSync();
    });
  }
  private async sync() {
    const h = this.view.household,
      session = this.view.session;
    if (!h || !session || !supabase) return;
    if (!navigator.onLine) {
      this.emit({ state: "offline" });
      return;
    }
    if (this.view.readOnly) {
      this.emit({
        error:
          "Another tab is the active editor. Close it and reload to edit here.",
      });
      return;
    }
    const blockedConflict = this.cache?.conflict;
    const epoch = this.epoch;
    this.emit({ state: "syncing", error: "" });
    try {
      let turns = 0;
      do {
        const { data: s, error } = await supabase
          .rpc("household_snapshot", {
            h: h.id,
          })
          .retry(false);
        if (error) throw error;
        if (epoch !== this.epoch) return;
        const confirmed = fromSnapshot(
          s,
          this.cache?.data.settings.theme ?? "system",
        );
        this.cache ??= {
          id: this.scopeKey(h.id),
          data: confirmed,
          confirmed,
          queue: [],
        };
        this.cache.confirmed = confirmed;
        this.cache.revocationBackup = undefined;
        const applied = overlay(confirmed, this.cache.queue);
        this.cache.data = {
          ...applied.data,
          settings: {
            ...applied.data.settings,
            theme: this.cache.data.settings.theme,
          },
        };
        this.cache.conflict = undefined;
        this.emit({
          data: this.cache.data,
          revision: s.revision,
          household: { id: s.id, name: s.name, owner_id: s.owner_id },
          pending: this.cache.queue.length,
          conflict: undefined,
        });
        await this.persist();
        if (blockedConflict) {
          this.cache.conflict = blockedConflict;
          await this.persist();
          this.emit({ state: "conflict", conflict: blockedConflict });
          return;
        }
        const op = this.cache.queue[0];
        if (!op) break;
        const result = await supabase
          .rpc("apply_household_changes", {
            h: h.id,
            operation: op.id,
            changes: JSON.parse(JSON.stringify(op.changes)),
          })
          .retry(false);
        if (result.error) throw result.error;
        if (result.data.conflict) {
          this.cache.conflict = {
            operation: op.id,
            table: result.data.table,
            key: result.data.key,
          };
          await this.persist();
          this.emit({
            state: "conflict",
            conflict: this.cache.conflict,
            error: "A simultaneous edit needs review in Family.",
          });
          return;
        }
        this.cache.queue.shift();
        await this.persist();
        turns++;
      } while (turns < 10);
      this.emit({
        state: this.cache?.queue.length ? "syncing" : "synced",
        pending: this.cache?.queue.length ?? 0,
        error: "",
      });
      if (this.cache?.queue.length) this.requestSync();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : ((e as { message?: string }).message ?? "Connection interrupted.");
      const locked = /access denied|permission denied/i.test(message);
      let backupWarning = "";
      if (locked && this.cache?.queue.length && !this.cache.revocationBackup) {
        try {
          this.cache.revocationBackup = await preserveBackup(
            this.cache.data,
            "Pending proposal — household access revoked",
            this.view.session?.user.id,
          );
          await this.persist();
        } catch {
          backupWarning =
            " Download your retained proposal now; extra backup storage was unavailable.";
        }
      }

      this.emit({
        state: locked ? "locked" : navigator.onLine ? "error" : "offline",
        data: locked ? emptyData() : this.view.data,
        error: locked
          ? "Household access is no longer available. Pending changes are preserved privately on this device." +
            backupWarning
          : `${message} Pending changes are retained and will retry.`,
      });
    }
  }
  async resolveConflict() {
    return this.serial(async () => {
      if (!this.cache) return;
      await preserveBackup(
        this.cache.data,
        "Conflict proposal — preserved before returning to shared version",
        this.view.session?.user.id,
      );
      await db.caches.put({
        id: `conflict:${this.cache.id}:${crypto.randomUUID()}`,
        value: structuredClone(this.cache),
      });
      const updated = {
        ...this.cache,
        queue: [],
        conflict: undefined,
        data: this.cache.confirmed,
      };
      await db.caches.put({ id: updated.id, value: updated });
      this.cache = updated;
      this.emit({
        data: this.cache.data,
        pending: 0,
        conflict: undefined,
        state: "syncing",
      });
      this.requestSync();
    });
  }
  async migrate() {
    return this.serial(async () => {
      if (!this.cache || !this.view.household)
        throw Error("Select an online household first.");
      if (this.cache.migrated)
        throw Error(
          "This local kitchen has already been migrated into this household.",
        );
      if (this.cache.queue.length)
        throw Error("Wait for pending changes to synchronize first.");
      const local = await readData();
      if (local.demo)
        throw Error(
          "Sample-mode groceries cannot be migrated. Reset demo first.",
        );
      const merged = mergeLocal(this.cache.data, local);
      await preserveBackup(
        local,
        "Original local kitchen — before family migration",
        this.view.session?.user.id,
      );
      const changes = diff(this.cache.data, merged);
      if (changes.length > 5000)
        throw Error("Migration exceeds 5000 changes. Use a smaller batch.");
      const updated = {
        ...this.cache,
        data: merged,
        migrated: true,
        queue: changes.length
          ? [
              {
                id: crypto.randomUUID(),
                changes,
                created: new Date().toISOString(),
                label: "Confirmed local-to-household migration",
              },
            ]
          : [],
      };
      await db.caches.put({ id: updated.id, value: updated });
      this.cache = updated;
      this.emit({
        migrated: true,
        data: merged,
        pending: this.cache.queue.length,
        state: "syncing",
      });
      this.requestSync();
    });
  }
  async replaceWithBackup(data: Data) {
    if (this.view.data)
      await preserveBackup(this.view.data, "Before confirmed backup restore");
    return this.save(data, "Confirmed backup restore");
  }
  async create(name: string, display: string) {
    if (!supabase) throw Error("Supabase is not configured.");
    const { data, error } = await supabase.rpc("create_household", {
      household_name: name,
      member_name: display,
    });
    if (error) throw error;
    await this.loadHouseholds();
    await this.select(data);
  }
  async accept(token: string, display: string) {
    if (!supabase) throw Error("Supabase is not configured.");
    const { data, error } = await supabase.rpc("accept_invitation", {
      token,
      member_name: display,
    });
    if (error) throw error;
    localStorage.removeItem(pendingInvitationKey);
    await this.loadHouseholds();
    await this.select(data);
  }
  pendingProposal() {
    return this.cache &&
      this.view.session &&
      this.view.household &&
      this.cache.id === this.scopeKey(this.view.household.id)
      ? structuredClone(this.cache.data)
      : undefined;
  }
  finishRecovery() {
    this.emit({ recovery: false });
  }
  async logout() {
    this.emit({ recovery: false });
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    await this.serial(() => this.setSession(null));
  }
}
export const kitchen = new KitchenStore();
