import { BookOpen } from "lucide-react";

import { LibraryCard } from "@/components/custom/LibraryCard";

export interface LibraryItem {
  id: string;
  title: string;
  source: string;
  type: "article" | "pdf";
  savedAt: string;
  progress: number;
}

// mock data:
const mockLibraryItems: LibraryItem[] = [
  {
    id: "1",
    title: "The Quiet Math of Compounding",
    source: "example.com",
    type: "article",
    savedAt: "2026-10-25",
    progress: 34,
  },
  {
    id: "2",
    title: "The Hidden Cost of Switching",
    source: "papers.example.edu",
    type: "pdf",
    savedAt: "2026-10-22",
    progress: 20,
  },
  {
    id: "3",
    title: "The Wealth of Nations",
    source: "Uploaded PDF",
    type: "pdf",
    savedAt: "2026-10-19",
    progress: 8,
  },
];

export default function LibraryPage({
  items = mockLibraryItems,
}: {
  items?: readonly LibraryItem[];
}) {
  return (
    <main
      aria-labelledby="library-title"
      className="min-w-0 flex-1 bg-[#f3f6f3] px-4 pt-6 pb-16 text-[#1a2c4b] md:px-8 md:pt-10"
    >
      <div className="@container mx-auto w-full max-w-272">
        <header className="flex items-baseline gap-6 border-b border-[#d3dcd7]">
          <h1 id="library-title" className="font-serif text-[28px] leading-10 font-normal">
            Library
          </h1>
        </header>

        {items.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-5 flex size-14 items-center justify-center rounded-xl bg-[#e3edd9]">
              <BookOpen className="size-7 text-[#496080]" aria-hidden="true" />
            </span>
            <h2 className="font-serif text-2xl font-normal">Your library is empty</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#587093]">
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
    </main>
  );
}
