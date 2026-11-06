import { describe, it, expect } from "vitest";
import { parseDueDate, isValidDueDate, daysUntilDue, dueStatus, priorityRank } from "../src/utils/taskMeta.js";

describe("taskMeta", () => {
  it("parses a due date as local midnight, not UTC", () => {
    const d = parseDueDate("2026-03-03");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 3, 0]);
  });

  it("rejects impossible dates", () => {
    expect(isValidDueDate("2026-02-30")).toBe(false);
    expect(isValidDueDate("2026-02-28")).toBe(true);
    expect(isValidDueDate("")).toBe(true);
  });

  it("counts days across a DST change as whole days", () => {
    const now = new Date(2026, 2, 7, 23, 0);
    expect(daysUntilDue("2026-03-09", now)).toBe(2);
  });

  it("flags overdue open tasks", () => {
    const now = new Date(2026, 10, 6, 9, 0);
    expect(dueStatus({ dueDate: "2026-11-05", done: false }, now)).toBe("overdue");
  });

  it("ranks P0 ahead of unprioritised tasks", () => {
    expect(priorityRank({ priority: "p0" })).toBeLessThan(priorityRank({ priority: "" }));
  });
});
