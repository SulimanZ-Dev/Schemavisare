export type Lesson = { id: string; year: number; isoWeek: number; date: string; start: string; end: string; subject: string; room?: string; teacher?: string; cancelled?: boolean };
export type ChangeKind = "cancelled" | "moved" | "changed" | "added";
export type ScheduleChange = { id: string; kind: ChangeKind; lesson: Lesson; previous?: Lesson; detectedAt: string; message: string };
export type ScheduleSnapshot = { lessons: Lesson[]; fetchedAt: string; source: "mock" | "skola24"; version: string };
export type ScheduleState = { snapshot: ScheduleSnapshot | null; changes: ScheduleChange[]; stale: boolean; error?: string };
export type NotificationSettings = { changes: boolean; reminders: boolean };
export interface ScheduleProvider { readonly name: "mock" | "skola24"; fetchWeeks(weekStarts: string[]): Promise<Lesson[]> }
export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string }; settings: NotificationSettings };
