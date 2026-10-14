import type { StartReadingProgressRequest } from "../types/readingProgress";
import { startReadingProgressTracking } from "./readingProgress";



chrome.runtime.onMessage.addListener(
  (message: StartReadingProgressRequest, _sender, sendResponse) => {
    if (message.type !== "START_READING_PROGRESS") {
      return;
    }

    const progress = startReadingProgressTracking();
    sendResponse({ ok: true, progress });
  },
);

console.debug("[Quiescent] Reading progress content script ready");
