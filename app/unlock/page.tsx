import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnlockClient } from "@/components/UnlockClient";

export default function UnlockPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to landing page
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Unlock the Monitoring Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Complete checkout first, then verify your paid email below. Your access cookie will be set immediately after verification.
        </p>
        <Button asChild className="w-full" size="lg">
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
            target="_blank"
            rel="noreferrer"
          >
            Buy Access - $12/month
          </a>
        </Button>
      </div>

      <div className="mt-6">
        <UnlockClient />
      </div>
    </main>
  );
}
