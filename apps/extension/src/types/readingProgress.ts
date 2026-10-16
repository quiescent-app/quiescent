export type ReadingProgressMetrics = {
  scrollHeight: number;
  viewportHeight: number;
  scrollY: number;
  headerHeight?: number;
  footerHeight?: number;
};

export type StartReadingProgressRequest = {
  type: "START_READING_PROGRESS";
};

export type ReadingProgressResponse = {
  ok: boolean;
  progress: number;
};

export type ReadingProgressUpdate = {
  type: "READING_PROGRESS_UPDATE";
  progress: number;
  url: string;
};
