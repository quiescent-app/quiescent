import { describe, expect, it } from "vitest";

import { calculateReadingProgress } from "../src/content/readingProgress";

describe("calculateReadingProgress", () => {
  it("reports the top, middle, and bottom of a scrollable page", () => {
    const metrics = { scrollHeight: 2000, viewportHeight: 500 };

    expect(calculateReadingProgress({ ...metrics, scrollY: 0 })).toBe(0);
    expect(calculateReadingProgress({ ...metrics, scrollY: 750 })).toBe(50);
    expect(calculateReadingProgress({ ...metrics, scrollY: 1500 })).toBe(100);
  });

  it("excludes header and footer landmarks from the reading range", () => {
    const metrics = {
      scrollHeight: 2200,
      viewportHeight: 500,
      headerHeight: 100,
      footerHeight: 100,
    };

    expect(calculateReadingProgress({ ...metrics, scrollY: 100 })).toBe(0);
    expect(calculateReadingProgress({ ...metrics, scrollY: 850 })).toBe(50);
    expect(calculateReadingProgress({ ...metrics, scrollY: 1600 })).toBe(100);
  });

  it("treats pages without a readable scroll range as complete", () => {
    expect(
      calculateReadingProgress({
        scrollHeight: 500,
        viewportHeight: 500,
        scrollY: 0,
      }),
    ).toBe(100);
  });

  it("clamps overscroll and rejects invalid values", () => {
    const metrics = { scrollHeight: 2000, viewportHeight: 500 };

    expect(calculateReadingProgress({ ...metrics, scrollY: -50 })).toBe(0);
    expect(calculateReadingProgress({ ...metrics, scrollY: 3000 })).toBe(100);
    expect(calculateReadingProgress({ ...metrics, scrollY: Number.NaN })).toBe(0);
    expect(
      calculateReadingProgress({ ...metrics, scrollY: Number.POSITIVE_INFINITY }),
    ).toBe(0);
  });
});
