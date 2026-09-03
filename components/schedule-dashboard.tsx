"use client";
import { useEffect, useState } from "react";
import { addDays, formatDate, formatUpdated, isoWeek, stockholmInstant } from "@/lib/dates";
import type { DemoKind } from "@/lib/demo";
import type { Lesson, NotificationSettings, ScheduleChange, ScheduleState } from "@/lib/types";

const initialSettings: NotificationSettings = { changes: false, reminders: false };
const b64 = (key: string) => Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), x => x.charCodeAt(0));

function lessonStatus(lesson: Lesson, changes: ScheduleChange[]) {
  const change = changes.find(c => c.lesson.id === lesson.id);
  return change?.kind ?? (lesson.cancelled ? "cancelled" : "");
}

const changeLabel = (kind: string) =>
  kind === "cancelled" ? "Inställd" : kind === "moved" ? "Ändrad dag" : kind === "added" ? "Ny post" : "Ändrad";

// Testmiljöns scenarier – varje knapp visar exakt en ändringstyp.
const demoScenarios: { kind: DemoKind; title: string; desc: string }[] = [
  { kind: "cancelled", title: "Inställd lektion", desc: "Hela lektionen försvinner – visas röd och överstruken med märkningen Inställd." },
  { kind: "changed-time", title: "Ändrad tid", desc: "Bara tiden ändras – visas orange med märkningen Ändrad." },
  { kind: "moved", title: "Flyttad dag", desc: "Lektionen flyttas till en annan dag – visas röd med märkningen Ändrad dag." },
  { kind: "added", title: "Ny post", desc: "En helt ny lektion läggs till – visas med märkningen Ny post." },
  { kind: "all", title: "Alla samtidigt", desc: "Visar samtliga fyra ovan på en gång." },
];

function Clock({ lessons }: { lessons: Lesson[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) {
    return <section className="status" aria-live="polite"><span className="status-label">CS26:s schema</span><h2>Hämtar aktuell status</h2><p className="status-meta">Dagens nästa lektion visas strax.</p></section>;
  }
  const active = lessons.filter(x => !x.cancelled).find(x => stockholmInstant(x.date, x.start) <= now && stockholmInstant(x.date, x.end) > now);
  const next = lessons.filter(x => !x.cancelled && stockholmInstant(x.date, x.start) > now)
    .sort((a, b) => stockholmInstant(a.date, a.start).getTime() - stockholmInstant(b.date, b.start).getTime())[0];
  const target = active ? stockholmInstant(active.date, active.end) : next ? stockholmInstant(next.date, next.start) : null;
  const seconds = target ? Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000)) : 0;
  const remaining = `${Math.floor(seconds / 3600)} tim ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")} min`;

  if (active) {
    return <section className="status" aria-live="polite"><span className="status-label">Pågår nu</span><h2>{active.subject}</h2><p className="status-meta">{active.start}–{active.end}{active.room ? ` · ${active.room}` : ""}</p><span className="countdown">Slutar om {remaining}</span></section>;
  }
  if (next) {
    return <section className="status" aria-live="polite"><span className="status-label">Nästa lektion</span><h2>{next.subject}</h2><p className="status-meta">{formatDate(next.date)} · {next.start}–{next.end}{next.room ? ` · ${next.room}` : ""}</p><span className="countdown">Börjar om {remaining}</span></section>;
  }
  return <section className="status"><span className="status-label">Skoldagen är klar</span><h2>Inga fler lektioner just nu</h2><p className="status-meta">Nästa schemalagda lektion visas när den finns i det aktuella fyraveckorsfönstret.</p></section>;
}

function LessonCard({ lesson, changes }: { lesson: Lesson; changes: ScheduleChange[] }) {
  const status = lessonStatus(lesson, changes);
  const change = changes.find(c => c.lesson.id === lesson.id);
  return (
    <article className={`lesson ${status}`}>
      <strong>{lesson.subject}</strong>
      <span className="lesson-time">{lesson.start}–{lesson.end}</span>
      {lesson.room && <span className="lesson-extra">{lesson.room}</span>}
      {lesson.teacher && <span className="lesson-extra">{lesson.teacher}</span>}
      {status && <span className={`pill ${status === "cancelled" ? "cancelled" : ""}`}>{changeLabel(status)}</span>}
      {change && <span className="lesson-extra">{change.message}</span>}
    </article>
  );
}
export function ScheduleDashboard({ initialState, weekStarts: starts, vapidPublicKey }: {
  initialState: ScheduleState; weekStarts: string[]; vapidPublicKey: string;
}) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [asked, setAsked] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [demoKind, setDemoKind] = useState<DemoKind | null>(null);
  const [demoState, setDemoState] = useState<ScheduleState | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  // När demoläget är på visas demotillståndet (tydligt märkt), annars det riktiga.
  const view = demoKind && demoState ? demoState : state;
  const lessons = view.snapshot?.lessons ?? [];

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
    const seen = localStorage.getItem("cs26-notice-seen");
    if (seen) setAsked(true);
    else {
      const timer = setTimeout(() => { setAsked(true); localStorage.setItem("cs26-notice-seen", "1"); }, 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", { cache: "no-store" });
      setState(await res.json());
    } finally { setLoading(false); }
  };

  const showDemo = async (kind: DemoKind) => {
    setDemoLoading(true);
    try {
      const res = await fetch(`/api/demo?kind=${kind}`, { cache: "no-store" });
      if (res.ok) {
        setDemoState(await res.json() as ScheduleState);
        setDemoKind(kind);
      }
    } finally { setDemoLoading(false); }
  };
  const clearDemo = () => { setDemoKind(null); setDemoState(null); };

  const saveSubscription = async (next: NotificationSettings) => {
    setSettings(next);
    if (!vapidPublicKey) return;
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!next.changes && !next.reminders) {
      if (sub) await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...sub.toJSON(), settings: next }) });
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") return;
    sub ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidPublicKey) });
    await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...sub.toJSON(), settings: next }) });
  };

  return (
<div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Kunskapsgruppen Yrkeshögskola</p>
          <h1>Enkel CS26 Schema</h1>
        </div>
        {view.snapshot && <p className="updated">Senast uppdaterad<br />{formatUpdated(view.snapshot.fetchedAt)}</p>}
      </header>

      {demoKind && demoState && (
        <p className="demo-banner" role="status">Demoläge – {demoScenarios.find(s => s.kind === demoKind)?.title}. Visar simulerade testdata (inte riktigt schema), beräknade med samma ändringslogik som produktionen.</p>
      )}

      <Clock lessons={lessons} />

      {view.stale && <p className="notice">Schemat kunde inte uppdateras just nu. Senast kända schema visas fortfarande.{view.error ? ` ${view.error}` : ""}</p>}

      <div className="tools">
        <span className="install">Vecka {isoWeek(new Date(`${starts[0]}T12:00:00Z`))}–{isoWeek(new Date(`${starts[3]}T12:00:00Z`))}</span>
        <button className="refresh" onClick={refresh} disabled={loading || !!demoKind}>{loading ? "Uppdaterar…" : "Uppdatera schema"}</button>
      </div>

      {view.changes.length > 0 && (
        <section className="changes">
          <h2>Senaste ändringar</h2>
          <ul>
            {view.changes.slice(0, 5).map(c => (
              <li className="change-item" key={c.id}>
                <span className={`pill ${c.kind === "cancelled" ? "cancelled" : ""}`}>{changeLabel(c.kind)}</span>{c.lesson.subject} — {c.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="testlab" aria-label="Testmiljö">
        <h2>Testmiljö</h2>
        <p>Tryck på en ändringstyp för att se exakt hur den visas på lektionskorten och i ”Senaste ändringar”. Allt är en tydligt märkt demo på mock-data med samma ändringslogik som produktionen – riktig schemadata rörs aldrig.</p>
        <div className="scenarios">
          {demoScenarios.map(s => (
            <button key={s.kind} className={`scenario ${demoKind === s.kind ? "active" : ""}`} onClick={() => showDemo(s.kind)} disabled={demoLoading}>
              <strong>{s.title}</strong><span>{s.desc}</span>
            </button>
          ))}
        </div>
        {demoKind && (
          <div className="testlab-actions">
            <button className="toggle on" onClick={clearDemo}>Visa riktigt schema</button>
            <span className="label">Demoläge på: {demoScenarios.find(s => s.kind === demoKind)?.title}</span>
          </div>
        )}
      </section>

      {starts.map(start => {
        const mon = new Date(`${start}T12:00:00Z`);
        const friday = addDays(mon, 4);
        return (
          <section className="week" key={start}>
            <h2 className="week-title">Vecka {isoWeek(mon)} <small>{formatDate(start)}–{formatDate(friday.toISOString().slice(0, 10))}</small></h2>
            <div className="days">
              {Array.from({ length: 5 }, (_, index) => {
                const date = addDays(mon, index).toISOString().slice(0, 10);
                const entries = lessons.filter(x => x.date === date).sort((a, b) => a.start.localeCompare(b.start));
                return (
                  <section className="day" key={date}>
                    <h3>{formatDate(date)}</h3>
                    {entries.length ? entries.map(x => <LessonCard key={x.id} lesson={x} changes={view.changes} />) : <p className="empty">Inga lektioner</p>}
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="settings">
        <details open={asked}>
          <summary>Notisinställningar</summary>
          <div className="settings-body">
            <p>Notiser är frivilliga.</p>
            <div className="choices">
              <label>
                <input type="checkbox" checked={settings.changes} onChange={e => saveSubscription({ ...settings, changes: e.target.checked })} />
                Schemaändringar och inställda lektioner
              </label>
              <label>
                <input type="checkbox" checked={settings.reminders} onChange={e => saveSubscription({ ...settings, reminders: e.target.checked })} />
                Påminnelse före aktiv lektion
              </label>
            </div>
            {notificationPermission === "denied" && <p>Notiser är blockerade i webbläsaren. Du kan aktivera dem igen i webbplatsens behörigheter.</p>}
          </div>
        </details>
      </section>
    </div>
  );
}