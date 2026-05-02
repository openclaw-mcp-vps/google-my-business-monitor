"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Building2, CheckCircle2, RefreshCcw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChangeAlert } from "@/components/ChangeAlert";
import { CompetitorCard } from "@/components/CompetitorCard";

type DashboardResponse = {
  competitors: Array<{
    id: number;
    name: string;
    profileUrl: string;
    location: string | null;
    isActive: boolean;
    checkIntervalMinutes: number;
    lastCheckedAt: string | null;
    latestSnapshot: {
      capturedAt: string;
      rating: number | null;
      reviewCount: number | null;
      photosCount: number | null;
      latestPostText: string | null;
      hours: Record<string, string>;
    } | null;
  }>;
  changes: Array<{
    id: number;
    competitorName: string;
    changeType: string;
    summary: string;
    detectedAt: string;
  }>;
  stats: {
    totalCompetitors: number;
    activeCompetitors: number;
    checksLast24h: number;
    changesLast7d: number;
  };
  daily: Array<{ day: string; count: number }>;
};

const initialForm = {
  name: "",
  profileUrl: "",
  location: "",
  alertEmail: "",
  alertWebhookUrl: "",
  checkIntervalMinutes: "60"
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scrapingId, setScrapingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/competitors", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to fetch data");
      }

      const payload = (await response.json()) as DashboardResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          profileUrl: form.profileUrl,
          location: form.location || undefined,
          alertEmail: form.alertEmail || undefined,
          alertWebhookUrl: form.alertWebhookUrl || undefined,
          checkIntervalMinutes: Number(form.checkIntervalMinutes)
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save competitor");
      }

      setMessage(`Now tracking ${payload.competitor.name}.`);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create competitor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runScrape(competitorId: number) {
    setScrapingId(competitorId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ competitorId })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Scrape failed");
      }

      setMessage(payload.message ?? "Scrape finished.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run scrape.");
    } finally {
      setScrapingId(null);
    }
  }

  async function removeCompetitor(competitorId: number) {
    setDeletingId(competitorId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/competitors?id=${competitorId}`, {
        method: "DELETE"
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed");
      }

      setMessage("Competitor removed from monitoring.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove competitor.");
    } finally {
      setDeletingId(null);
    }
  }

  const stats = useMemo(
    () =>
      data?.stats ?? {
        totalCompetitors: 0,
        activeCompetitors: 0,
        checksLast24h: 0,
        changesLast7d: 0
      },
    [data]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--muted)]">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Competitor Monitoring Dashboard</h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Track competitor profile activity every hour, spot optimization moves quickly, and trigger alerts before lost local traffic turns into lost revenue.
        </p>
      </header>

      {error ? (
        <Card className="border-[var(--danger)]">
          <CardContent className="p-4 text-sm text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      {message ? (
        <Card className="border-[var(--success)]">
          <CardContent className="p-4 text-sm text-emerald-300">{message}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Competitors</p>
              <p className="mt-1 text-2xl font-bold">{stats.totalCompetitors}</p>
            </div>
            <Building2 className="h-6 w-6 text-[var(--primary)]" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Active Trackers</p>
              <p className="mt-1 text-2xl font-bold">{stats.activeCompetitors}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Checks (24h)</p>
              <p className="mt-1 text-2xl font-bold">{stats.checksLast24h}</p>
            </div>
            <Activity className="h-6 w-6 text-sky-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Changes (7d)</p>
              <p className="mt-1 text-2xl font-bold">{stats.changesLast7d}</p>
            </div>
            <BellRing className="h-6 w-6 text-amber-400" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detected Changes Trend</CardTitle>
            <CardDescription>
              Daily volume of competitor profile updates in the last two weeks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.daily ?? []}>
                  <defs>
                    <linearGradient id="changeTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f81f7" stopOpacity={0.65} />
                      <stop offset="100%" stopColor="#2f81f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#30363d" />
                  <XAxis dataKey="day" stroke="#8b949e" fontSize={12} />
                  <YAxis stroke="#8b949e" allowDecimals={false} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: 10,
                      color: "#f0f6fc"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#2f81f7"
                    fill="url(#changeTrend)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Competitor</CardTitle>
            <CardDescription>
              Add a Google profile URL to monitor hours, reviews, photos, and posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={createCompetitor}>
              <div className="space-y-1">
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, name: event.target.value }))
                  }
                  placeholder="Downtown Family Dental"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profileUrl">Google profile URL</Label>
                <Textarea
                  id="profileUrl"
                  required
                  value={form.profileUrl}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      profileUrl: event.target.value
                    }))
                  }
                  placeholder="https://www.google.com/maps/place/..."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="location">Location label</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, location: event.target.value }))
                    }
                    placeholder="Austin, TX"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkInterval">Check interval (minutes)</Label>
                  <Input
                    id="checkInterval"
                    type="number"
                    min={15}
                    max={720}
                    value={form.checkIntervalMinutes}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        checkIntervalMinutes: event.target.value
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="alertEmail">Alert email</Label>
                <Input
                  id="alertEmail"
                  type="email"
                  value={form.alertEmail}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, alertEmail: event.target.value }))
                  }
                  placeholder="you@agency.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="alertWebhook">Webhook URL</Label>
                <Input
                  id="alertWebhook"
                  value={form.alertWebhookUrl}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      alertWebhookUrl: event.target.value
                    }))
                  }
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving competitor..." : "Save and Start Tracking"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tracked Competitors</h2>
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={refreshing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {data?.competitors.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.competitors.map((competitor) => (
              <CompetitorCard
                key={competitor.id}
                competitor={competitor}
                scraping={scrapingId === competitor.id}
                deleting={deletingId === competitor.id}
                onScrape={runScrape}
                onDelete={removeCompetitor}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-[var(--muted)]">
              No competitors yet. Add your first profile and run an immediate check.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3 pb-8">
        <h2 className="text-xl font-semibold">Recent Alerts</h2>
        {data?.changes.length ? (
          <div className="grid gap-3">
            {data.changes.slice(0, 15).map((change) => (
              <ChangeAlert
                key={change.id}
                competitorName={change.competitorName}
                changeType={change.changeType}
                summary={change.summary}
                detectedAt={change.detectedAt}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-[var(--muted)]">
              No changes detected yet. Checks will add alerts when competitors update hours, photos, reviews, or posts.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
