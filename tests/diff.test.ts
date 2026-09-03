import { describe, expect, it } from "vitest";
import { diffSchedules } from "@/lib/diff";
import { addDays, isoWeek, lessonEnded, lessonWithinReminderWindow, mondayFor, stockholmInstant } from "@/lib/dates";
import type { Lesson } from "@/lib/types";
const lesson = (overrides: Partial<Lesson> = {}): Lesson => ({ id:"a",year:2026,isoWeek:4,date:"2026-01-19",start:"10:00",end:"12:00",subject:"JavaScript",...overrides });
describe("schema-diffning",()=>{it("skapar ingen ändring för baslinje",()=>expect(diffSchedules([],[])).toEqual([]));it("hittar ändrad tid",()=>expect(diffSchedules([lesson()],[lesson({end:"13:00"})])[0]).toMatchObject({kind:"changed"}));it("matchar flyttad lektion löst per vecka och ämne",()=>expect(diffSchedules([lesson()],[lesson({id:"b",date:"2026-01-20",start:"09:00"})])[0]).toMatchObject({kind:"moved"}));it("markerar borttagen lektion som inställd efter lyckad sync",()=>expect(diffSchedules([lesson()],[])[0]).toMatchObject({kind:"cancelled",lesson:{cancelled:true}}));it("skapar ny post",()=>expect(diffSchedules([],[lesson()])[0]).toMatchObject({kind:"added"}));});
describe("svenska kalenderregler",()=>{it("använder ISO-vecka över årsskiftet",()=>expect(isoWeek(new Date("2021-01-01T12:00:00Z"))).toBe(53));it("börjar veckofönstret på måndag",()=>expect(mondayFor(new Date("2026-01-18T12:00:00Z")).getUTCDay()).toBe(1));it("håller datum på rätt sida av sommartid",()=>expect(stockholmInstant("2026-03-29","09:00").getTime()).toBeGreaterThan(stockholmInstant("2026-03-29","08:00").getTime()));it("går fem vardagar till nästa måndag",()=>expect(addDays(new Date("2026-01-19T12:00:00Z"),7).getUTCDay()).toBe(1));});
describe("sommar-/vintertid",()=>{
  it("översätter lokal tid med rätt UTC-offset",()=>{
    expect(stockholmInstant("2026-06-10","13:00").getUTCHours()).toBe(11); // CEST +2
    expect(stockholmInstant("2026-01-14","13:00").getUTCHours()).toBe(12); // CET +1
  });
  it("påminnelselucka fungerar likadant oavsett DST",()=>{
    for (const iso of ["2026-06-10","2026-01-14","2026-03-29"]) {
      const justBefore = stockholmInstant(iso,"13:00").getTime() - 5*60000;
      expect(lessonWithinReminderWindow(iso,"13:00",justBefore)).toBe(true);
      const tooEarly = stockholmInstant(iso,"13:00").getTime() - 61*60000;
      expect(lessonWithinReminderWindow(iso,"13:00",tooEarly)).toBe(false);
    }
  });
  it("lektion räknas avslutad först när den passerat i lokal tid",()=>{
    expect(lessonEnded("2026-03-29","12:00",stockholmInstant("2026-03-29","12:00").getTime())).toBe(true);
    expect(lessonEnded("2026-03-29","12:00",stockholmInstant("2026-03-29","11:59").getTime())).toBe(false);
  });
});
