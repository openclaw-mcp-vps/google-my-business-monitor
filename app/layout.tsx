import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://google-my-business-monitor.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Google My Business Monitor | Competitor Change Alerts",
  description:
    "Monitor competitor Google Business profiles for hours, photos, reviews, and post changes. Get alerts before your competitors steal local search traffic.",
  keywords: [
    "google business profile monitor",
    "local seo competitor tracking",
    "google maps competitor alerts",
    "small business marketing analytics"
  ],
  openGraph: {
    title: "Google My Business Monitor",
    description:
      "Track competitor profile changes hourly and react faster with instant alerts.",
    url: siteUrl,
    siteName: "Google My Business Monitor",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Google My Business Monitor",
    description:
      "Track competitor Google Business profile changes hourly and act before they do."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="grid-glow">{children}</body>
    </html>
  );
}
