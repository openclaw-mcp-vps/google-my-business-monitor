import Link from "next/link";
import { ArrowRight, Bell, ChartSpline, Clock3, MapPinned, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Clock3,
    title: "Hourly Change Checks",
    description:
      "Automated checks pull hours, photos, review counts, and post activity from competitor profiles every hour."
  },
  {
    icon: Bell,
    title: "Instant Alert Routing",
    description:
      "Route updates to email or webhook destinations so teams can react before rankings and conversions shift."
  },
  {
    icon: ChartSpline,
    title: "Change Trend Analytics",
    description:
      "See exactly when competitors become more aggressive with updates and correlate that timing with your lead volume."
  },
  {
    icon: ShieldCheck,
    title: "Paywalled Intelligence",
    description:
      "Subscription-only dashboard keeps competitive research protected, private, and tied to verified customers."
  }
];

const faq = [
  {
    question: "How quickly will I know when a competitor changes their profile?",
    answer:
      "Checks run every hour by default, and you can also trigger manual checks immediately from the dashboard for high-priority competitors."
  },
  {
    question: "What profile elements does this track right now?",
    answer:
      "The monitor tracks visible business hours, photo count, average rating, review count, and latest post snippets so you can spot optimization changes fast."
  },
  {
    question: "Can agencies manage multiple clients?",
    answer:
      "Yes. Agencies can use one account to track multiple local markets, assign alert destinations per competitor, and share insights with client teams."
  },
  {
    question: "What do I need to do after payment?",
    answer:
      "After completing Stripe checkout, open the unlock page, enter the same checkout email, and the app issues secure access cookies for the dashboard."
  }
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[color:rgba(22,27,34,0.85)] p-8 sm:p-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <MapPinned className="h-3.5 w-3.5 text-[var(--primary)]" />
          Local Business Competitive Intelligence
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Monitor competitor Google Business profiles for changes before they outrank you.
        </h1>
        <p className="mt-4 max-w-3xl text-base text-[var(--muted)] sm:text-lg">
          Google My Business Monitor tracks competitor hours, photos, reviews, and posts so local businesses can react faster, protect map-pack visibility, and stop losing high-intent customers to quicker competitors.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="text-base">
            <a
              href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
              target="_blank"
              rel="noreferrer"
            >
              Start Monitoring - $12/month
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-base">
            <Link href="/unlock">I already paid, unlock dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The Local SEO Problem</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Competitors that update hours, publish posts, and collect fresh reviews often gain visibility in local pack rankings before slower businesses even notice.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What This Solves</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            You get immediate visibility into profile movement, so your team can respond with updated offers, review campaigns, and profile optimizations the same day.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Who Uses It</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Independent local businesses and growth-focused agencies that need practical, fast competitor monitoring without enterprise software overhead.
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <feature.icon className="h-5 w-5 text-[var(--primary)]" />
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Simple Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-bold">$12/month</p>
            <p className="max-w-2xl text-sm text-[var(--muted)]">
              Monitor unlimited competitor profiles in one workspace, run hourly checks, trigger webhook/email alerts, and access change trend analytics built specifically for local business operators.
            </p>
            <Button asChild size="lg">
              <a
                href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
                target="_blank"
                rel="noreferrer"
              >
                Buy with Stripe Hosted Checkout
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4 pb-10">
        <h2 className="text-2xl font-semibold">FAQ</h2>
        {faq.map((item) => (
          <Card key={item.question}>
            <CardHeader>
              <CardTitle className="text-lg">{item.question}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{item.answer}</CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
