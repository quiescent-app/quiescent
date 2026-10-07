import type { ReadingProgressMetrics } from "../types/readingProgress";

export function calculateReadingProgress({
  scrollHeight,
  viewportHeight,
  scrollY,
  headerHeight = 0,
  footerHeight = 0,
}: ReadingProgressMetrics): number {
  const values = [
    scrollHeight,
    viewportHeight,
    scrollY,
    headerHeight,
    footerHeight,
  ];

  if (values.some((value) => !Number.isFinite(value))) {
    return 0;
  }

  const safeHeaderHeight = Math.max(0, headerHeight);
  const safeFooterHeight = Math.max(0, footerHeight);
  const readableHeight = Math.max(
    0,
    scrollHeight - safeHeaderHeight - safeFooterHeight,
  );
  const scrollableHeight = readableHeight - Math.max(0, viewportHeight);

  if (scrollableHeight <= 0) {
    return 100;  // readable content is fully visible
  }

  const readableScrollY = Math.max(0, scrollY - safeHeaderHeight);
  const progress = (readableScrollY / scrollableHeight) * 100;

  return Math.round(Math.min(100, Math.max(0, progress)));
}
