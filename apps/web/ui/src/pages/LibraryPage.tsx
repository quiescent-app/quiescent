import { BookOpen } from "lucide-react";

import { LibraryCard } from "@/components/custom/LibraryCard";
import type { LibraryItem } from "@/types/library";

// mock data:
const mockLibraryItems: LibraryItem[] = [
  {
    id: "1",
    title: "The Quiet Math of Compounding",
    domain: "example.com",
    type: "article",
    createdAt: "2026-10-25T12:00:00Z",
    readingProgress: 34,
  },
  {
    id: "2",
    title: "The Hidden Cost of Switching",
    domain: "papers.example.edu",
    type: "pdf",
    createdAt: "2026-10-22T12:00:00Z",
    readingProgress: 20,
  },
  {
    id: "3",
    title: "The Wealth of Nations",
    domain: "Uploaded PDF",
    type: "pdf",
    createdAt: "2026-10-19T12:00:00Z",
    readingProgress: 8,
  },
];

export default function LibraryPage({
  items = mockLibraryItems,
}: {
  items?: readonly LibraryItem[];
}) {
  return (
    <section
      aria-labelledby="library-title"
      className="min-w-0 flex-1 bg-library-background px-4 pt-6 pb-16 text-library-foreground md:px-8 md:pt-10"
    >
      <div className="@container mx-auto w-full max-w-272">
        <header className="flex items-baseline gap-6 border-b border-library-border">
          <h1 id="library-title" className="font-serif text-[28px] leading-10 font-normal">
            Library
          </h1>
        </header>

        {items.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-5 flex size-14 items-center justify-center rounded-xl bg-library-accent">
              <BookOpen className="size-7 text-library-icon" aria-hidden="true" />
            </span>
            <h2 className="font-serif text-2xl font-normal">Your library is empty</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-library-muted-foreground">
              Articles and PDFs you save will appear here, along with your reading progress.
            </p>
          </div>
        ) : (
          <ul
            aria-label="Saved reading items"
            className="mt-7 grid grid-cols-1 gap-3 @[600px]:grid-cols-2 @[960px]:grid-cols-3"
          >
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <LibraryCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
