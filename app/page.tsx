import { ScheduleDashboard } from "@/components/schedule-dashboard";
import { weekStarts } from "@/lib/dates";
import { getPublicSchedule } from "@/lib/sync";

export const dynamic = "force-dynamic";
export default async function Home() {
  const state = await getPublicSchedule();
  return <main><ScheduleDashboard initialState={state} weekStarts={weekStarts()} vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} /></main>;
}
