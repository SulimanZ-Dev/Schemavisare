import { store } from "./store";

export type SimulationState = { enabled: boolean };

// Enbart minnesbaserat och enbart läst av mock-providern. Rör aldrig Redis,
// så det kan aldrig påverka produktion (som använder Skola24).
export const getSimulation = (): Promise<SimulationState> => store.sim();
export const setSimulation = (state: SimulationState): Promise<void> => store.setSim(state);