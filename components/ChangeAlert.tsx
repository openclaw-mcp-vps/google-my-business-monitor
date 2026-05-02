import { Clock3, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ChangeAlertProps = {
  competitorName: string;
  changeType: string;
  summary: string;
  detectedAt: string;
};

function toneForType(changeType: string) {
  switch (changeType) {
    case "reviews":
      return "success" as const;
    case "rating":
      return "success" as const;
    case "hours":
      return "danger" as const;
    case "posts":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

export function ChangeAlert({
  competitorName,
  changeType,
  summary,
  detectedAt
}: ChangeAlertProps) {
  return (
    <Card className="border-l-4 border-l-[var(--primary)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{competitorName}</CardTitle>
          <Badge variant={toneForType(changeType)}>{changeType.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-[var(--text)]">{summary}</p>
        <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Triggered Alert
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(detectedAt).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
