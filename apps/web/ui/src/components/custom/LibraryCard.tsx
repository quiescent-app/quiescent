import { FileText, MoreHorizontal, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { LibraryItem } from "@/pages/LibraryPage";

interface LibraryCardProps {
  item: LibraryItem;
}

const savedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function LibraryCard({ item }: LibraryCardProps) {
  const isPdf = item.type === "pdf";
  const Icon = isPdf ? FileText : Newspaper;
  const progress = Number.isFinite(item.progress)
    ? Math.min(100, Math.max(0, item.progress))
    : 0;
  const savedDate = savedDateFormatter.format(new Date(item.savedAt));

  return (
    <Card className="h-full gap-0 rounded-xl border border-[#d3dcd7] bg-white p-4 text-[#1a2c4b] ring-0 has-data-[slot=card-footer]:pb-4">
      <CardHeader className="flex min-h-16 flex-row items-start gap-3 p-0">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e3edd9] text-[#496080]">
          <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 font-serif text-xl leading-7 font-normal wrap-anywhere">
          {item.title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mt-1.5 -mr-2 size-7 shrink-0 text-[#496080] hover:bg-[#e3edd9]"
          aria-label={`More options for ${item.title}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </CardHeader>

      <CardContent className="mt-auto px-0 pt-1.5 pb-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4 text-[#587093]">
          <span className="min-w-0 wrap-anywhere">{item.source}</span>
          <span aria-hidden="true">·</span>
          <Badge
            variant="secondary"
            className="h-4 rounded-sm border-0 bg-[#e3edd9] px-1.5 py-0 text-[10px] font-normal text-[#385276] uppercase"
          >
            {isPdf ? "PDF" : "Article"}
          </Badge>
          <span aria-hidden="true">·</span>
          <span>
            Saved <time dateTime={item.savedAt}>{savedDate}</time>
          </span>
        </div>
      </CardContent>

      <CardFooter className="mt-2 flex items-center gap-4 border-0 bg-transparent p-0">
        <Progress
          value={progress}
          aria-label={`Reading progress for ${item.title}`}
          className="min-w-0 flex-1 [&_[data-slot=progress-indicator]]:bg-[#1a2c4b] [&_[data-slot=progress-track]]:bg-[#d3dcd7]"
        />
        <span className="min-w-7.5 text-right text-[11px] tabular-nums">{progress}%</span>
      </CardFooter>
    </Card>
  );
}
