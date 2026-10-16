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
    return 100; // Readable content is fully visible.
  }

  const readableScrollY = Math.max(0, scrollY - safeHeaderHeight);
  const progress = (readableScrollY / scrollableHeight) * 100;

  return Math.round(Math.min(100, Math.max(0, progress)));
}

let isTracking = false;
let animationFrameId: number | null = null;
let lastProgress: number | null = null;
let resizeObserver: ResizeObserver | null = null;

const getLandmarkHeight = (selector: "header" | "footer") => {
  const landmark = document.querySelector<HTMLElement>(selector);

  if (!landmark) {
    return 0;
  }

  const height = landmark.getBoundingClientRect().height;
  return Number.isFinite(height) ? height : 0;
};

const getCurrentProgress = () =>
  calculateReadingProgress({
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    scrollY: window.scrollY,
    headerHeight: getLandmarkHeight("header"),
    footerHeight: getLandmarkHeight("footer"),
  });

const reportProgress = () => {
  animationFrameId = null;

  const progress = getCurrentProgress();

  if (progress === lastProgress) {
    return;
  }

  lastProgress = progress;
  console.debug(`[Quiescent] Reading progress: ${progress}%`);
  void chrome.runtime
    .sendMessage({
      type: "READING_PROGRESS_UPDATE",
      progress,
      url: window.location.href,
    })
    .catch(() => undefined);
};

const scheduleProgressReport = () => {
  if (animationFrameId === null) {
    animationFrameId = window.requestAnimationFrame(reportProgress);
  }
};

export const startReadingProgressTracking = () => {
  if (!isTracking) {
    isTracking = true;
    window.addEventListener("scroll", scheduleProgressReport, { passive: true });
    window.addEventListener("resize", scheduleProgressReport);

    resizeObserver = new ResizeObserver(scheduleProgressReport);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
  }

  const progress = getCurrentProgress();
  lastProgress = progress;
  console.debug(`[Quiescent] Reading progress: ${progress}%`);

  return progress;
};
