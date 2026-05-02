import { ExternalLink, RefreshCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Snapshot = {
  capturedAt: string;
  rating: number | null;
  reviewCount: number | null;
  photosCount: number | null;
  latestPostText: string | null;
  hours: Record<string, string>;
};

type CompetitorCardProps = {
  competitor: {
    id: number;
    name: string;
    profileUrl: string;
    location: string | null;
    isActive: boolean;
    checkIntervalMinutes: number;
    lastCheckedAt: string | null;
    latestSnapshot: Snapshot | null;
  };
  scraping: boolean;
  deleting: boolean;
  onScrape: (id: number) => void;
  onDelete: (id: number) => void;
};

export function CompetitorCard({
  competitor,
  scraping,
  deleting,
  onScrape,
  onDelete
}: CompetitorCardProps) {
  const snapshot = competitor.latestSnapshot;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{competitor.name}</CardTitle>
            {competitor.location ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{competitor.location}</p>
            ) : null}
          </div>
          <Badge variant={competitor.isActive ? "success" : "secondary"}>
            {competitor.isActive ? "Tracking" : "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <a
          href={competitor.profileUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[var(--primary)] hover:underline"
        >
          Open profile
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-[var(--muted)]">Rating</p>
            <p className="mt-1 text-sm font-semibold">{snapshot?.rating ?? "-"}</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-[var(--muted)]">Reviews</p>
            <p className="mt-1 text-sm font-semibold">{snapshot?.reviewCount ?? "-"}</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-[var(--muted)]">Photos</p>
            <p className="mt-1 text-sm font-semibold">{snapshot?.photosCount ?? "-"}</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-[var(--muted)]">Check Interval</p>
            <p className="mt-1 text-sm font-semibold">{competitor.checkIntervalMinutes} min</p>
          </div>
        </div>

        {snapshot?.latestPostText ? (
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
            <p className="mb-1 font-semibold text-[var(--text)]">Latest post excerpt</p>
            {snapshot.latestPostText}
          </div>
        ) : null}

        <p className="text-xs text-[var(--muted)]">
          Last checked: {competitor.lastCheckedAt ? new Date(competitor.lastCheckedAt).toLocaleString() : "Never"}
        </p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onScrape(competitor.id)}
          disabled={scraping}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          {scraping ? "Checking..." : "Check now"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(competitor.id)}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleting ? "Removing..." : "Remove"}
        </Button>
      </CardFooter>
    </Card>
  );
}
