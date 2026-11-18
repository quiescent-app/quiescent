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

import { formatDate } from "@/utils/format";
import type { LibraryItem } from "@/types/library";

interface LibraryCardProps {
  item: LibraryItem;
}

export function LibraryCard({ item }: LibraryCardProps) {
  const isPdf = item.type === "pdf";
  const Icon = isPdf ? FileText : Newspaper;
  const progress = Number.isFinite(item.readingProgress)
    ? Math.min(100, Math.max(0, item.readingProgress))
    : 0;
  const savedDate = formatDate(item.createdAt);

  return (
    <Card className="h-full gap-0 rounded-xl border border-library-border bg-white p-4 text-library-foreground ring-0 has-data-[slot=card-footer]:pb-4">
      <CardHeader className="flex min-h-16 flex-row items-start gap-3 p-0">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-library-accent text-library-icon">
          <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 font-serif text-xl leading-7 font-normal wrap-anywhere">
          {item.title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mt-1.5 -mr-2 size-7 shrink-0 text-library-icon hover:bg-library-accent"
          aria-label={`More options for ${item.title}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </CardHeader>

      <CardContent className="mt-auto px-0 pt-1.5 pb-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4 text-library-muted-foreground">
          <span className="min-w-0 wrap-anywhere">{item.domain}</span>
          <span aria-hidden="true">·</span>
          <Badge
            variant="secondary"
            className="h-4 rounded-sm border-0 bg-library-accent px-1.5 py-0 text-[10px] font-normal text-library-accent-foreground uppercase"
          >
            {isPdf ? "PDF" : "Article"}
          </Badge>
          <span aria-hidden="true">·</span>
          <span>
            Saved <time dateTime={item.createdAt}>{savedDate}</time>
          </span>
        </div>
      </CardContent>

      <CardFooter className="mt-2 flex items-center gap-4 border-0 bg-transparent p-0">
        <Progress
          value={progress}
          aria-label={`Reading progress for ${item.title}`}
          className="min-w-0 flex-1 [&_[data-slot=progress-indicator]]:bg-library-foreground [&_[data-slot=progress-track]]:bg-library-border"
        />
        <span className="min-w-7.5 text-right text-[11px] tabular-nums">{progress}%</span>
      </CardFooter>
    </Card>
  );
}
