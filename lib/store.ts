import type { PushSubscriptionInput, ScheduleChange, ScheduleSnapshot } from "./types";
type Memory = { snapshot?: ScheduleSnapshot; changes: ScheduleChange[]; refreshAt?: number; subscriptions: Record<string, PushSubscriptionInput>; sim?: { enabled: boolean } };
const globalStore = globalThis as typeof globalThis & { __cs26Store?: Memory };
const memory = () => globalStore.__cs26Store ??= { changes: [], subscriptions: {} };
const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(command: unknown[]) { if (!url || !token) return undefined; const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(command), cache: "no-store" }); if (!response.ok) throw new Error("Redis kunde inte nås"); return (await response.json()).result; }
export const store = {
  async snapshot() { const value = await redis(["GET", "cs26:snapshot"]); return value ? JSON.parse(value as string) as ScheduleSnapshot : memory().snapshot; },
  async setSnapshot(snapshot: ScheduleSnapshot) { const result = await redis(["SET", "cs26:snapshot", JSON.stringify(snapshot)]); if (result === undefined) memory().snapshot = snapshot; },
  async changes() { const value = await redis(["GET", "cs26:changes"]); return value ? JSON.parse(value as string) as ScheduleChange[] : memory().changes; },
  async setChanges(changes: ScheduleChange[]) { const result = await redis(["SET", "cs26:changes", JSON.stringify(changes)]); if (result === undefined) memory().changes = changes; },
  async refreshAllowed(cooldownMs = 120000) { const now = Date.now(); const value = await redis(["SET", "cs26:refresh-lock", String(now), "NX", "PX", String(cooldownMs)]); if (value !== undefined) return value === "OK"; if ((memory().refreshAt ?? 0) + cooldownMs > now) return false; memory().refreshAt = now; return true; },
  async subscriptions() { const value = await redis(["GET", "cs26:subscriptions"]); return value ? JSON.parse(value as string) as Record<string, PushSubscriptionInput> : memory().subscriptions; },
  async saveSubscription(sub: PushSubscriptionInput) { const entries = await this.subscriptions(); entries[sub.endpoint] = sub; const result = await redis(["SET", "cs26:subscriptions", JSON.stringify(entries)]); if (result === undefined) memory().subscriptions = entries; },
  async removeSubscription(endpoint: string) { const entries = await this.subscriptions(); delete entries[endpoint]; const result = await redis(["SET", "cs26:subscriptions", JSON.stringify(entries)]); if (result === undefined) memory().subscriptions = entries; },
  async claimNotification(key: string) { const value = await redis(["SET", `cs26:sent:${key}`, "1", "NX", "EX", "2592000"]); if (value !== undefined) return value === "OK"; const sent = (memory() as Memory & { sent?: Set<string> }).sent ??= new Set(); if (sent.has(key)) return false; sent.add(key); return true; },
  // Testmiljöflaggan lagras uteslutande i minnet (aldrig i Redis) och läses bara av mock-providern.
  async sim() { return memory().sim ?? { enabled: false }; },
  async setSim(s: { enabled: boolean }) { memory().sim = s; },
};
