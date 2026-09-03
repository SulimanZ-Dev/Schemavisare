import { diffSchedules } from "./diff";
import { weekStarts } from "./dates";
import { applySimulation, ALL_MOCK_CHANGES, buildMockLessons, type MockChangeKind } from "./providers/mock";
import type { ScheduleState } from "./types";

// Demoläget är en tydligt märkt, fristående demo som kör samma riktiga
// difflogik som produktionen, men på deterministiska mock-data. Den rör
// aldrig den riktiga schemadatan, Redis-snapshotten eller ändringarna –
// allt beräknas här och cachas bara i processminnet.
export type DemoKind = MockChangeKind | "all";
export const DEMO_KINDS: DemoKind[] = ["all", "cancelled", "changed-time", "moved", "added"];

const cache: Partial<Record<DemoKind, ScheduleState>> = {};

export function resetDemoCache(): void {
  for (const k of DEMO_KINDS) delete cache[k];
}

export async function getDemoSchedule(kind: DemoKind = "all"): Promise<ScheduleState> {
  const cachedState = cache[kind];
  if (cachedState) return cachedState;
  const starts = weekStarts();
  const base = buildMockLessons(starts);
  const kinds: MockChangeKind[] = kind === "all" ? ALL_MOCK_CHANGES : [kind as MockChangeKind];
  const simulated = applySimulation(starts, base, kinds);
  const snapshot = {
    lessons: simulated,
    fetchedAt: new Date().toISOString(),
    source: "mock" as const,
    version: JSON.stringify(simulated),
  };
  const state: ScheduleState = {
    snapshot,
    changes: diffSchedules(base, simulated),
    stale: false,
  };
  cache[kind] = state;
  return state;
}