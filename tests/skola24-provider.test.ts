import { describe, expect, it } from "vitest";
import { isoWeek } from "@/lib/dates";
describe("Skola24-normalisering", () => { it("har rätt ISO-vecka för schemats måndag", () => expect(isoWeek(new Date("2026-08-31T12:00:00Z"))).toBe(36)); });
