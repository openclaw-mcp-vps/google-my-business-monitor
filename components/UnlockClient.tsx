"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnlockClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function unlockAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/paywall/unlock", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not verify subscription");
      }

      setMessage("Access unlocked. Redirecting to dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Unlock Your Paid Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Enter the same email used during Stripe checkout. We verify it against paid subscriptions and set secure dashboard access cookies.
        </p>

        {error ? (
          <div className="rounded-md border border-[var(--danger)] bg-[color:rgba(218,54,51,0.08)] px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-md border border-[var(--success)] bg-[color:rgba(35,134,54,0.08)] px-3 py-2 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={unlockAccess}>
          <div className="space-y-1">
            <Label htmlFor="email">Checkout email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@business.com"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying access..." : "Unlock Dashboard"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
