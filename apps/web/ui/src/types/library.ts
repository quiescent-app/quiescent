export interface LibraryItem {
  id: string;
  title: string;
  domain: string;
  type?: "article" | "pdf";
  createdAt: string;
  readingProgress: number;
}
