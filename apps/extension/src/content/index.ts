import { calculateReadingProgress } from "./readingProgress";
import type { StartReadingProgressRequest } from "../types/readingProgress";

let isTracking = false;
let animationFrameId: number | null = null;
let lastProgress: number | null = null;

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

const resizeObserver = new ResizeObserver(scheduleProgressReport);

const startTracking = () => {
  if (!isTracking) { // initialize tracking listeners
    isTracking = true;
    window.addEventListener("scroll", scheduleProgressReport, { passive: true });
    window.addEventListener("resize", scheduleProgressReport);
    resizeObserver.observe(document.documentElement);
  }

  const progress = getCurrentProgress();
  lastProgress = progress;
  console.debug(`[Quiescent] Reading progress: ${progress}%`);

  return progress;
};

chrome.runtime.onMessage.addListener(
  (message: StartReadingProgressRequest, _sender, sendResponse) => {
    if (message.type !== "START_READING_PROGRESS") {
      return;
    }

    const progress = startTracking();
    sendResponse({ ok: true, progress });
  },
);

console.debug("[Quiescent] Reading progress content script ready");
