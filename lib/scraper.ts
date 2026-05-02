import * as cheerio from "cheerio";
import puppeteer, { type LaunchOptions } from "puppeteer";

export type ScrapedProfileData = {
  sourceUrl: string;
  capturedAt: string;
  hours: Record<string, string>;
  rating: number | null;
  reviewCount: number | null;
  photosCount: number | null;
  latestPostText: string | null;
  latestPostDate: string | null;
  rawSignals: {
    title: string | null;
    snippets: string[];
  };
};

export type ProfileChange = {
  type: "hours" | "rating" | "reviews" | "photos" | "posts";
  summary: string;
  beforeValue: unknown;
  afterValue: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeHours(hours: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(hours)
      .map(([day, value]) => [day.trim(), value.trim()])
      .filter(([day, value]) => day.length > 0 && value.length > 0)
  );
}

function extractHoursFromJsonLd($: cheerio.CheerioAPI) {
  const hours: Record<string, string> = {};

  $("script[type='application/ld+json']").each((_, node) => {
    const raw = $(node).text();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as
        | Record<string, unknown>
        | Array<Record<string, unknown>>;

      const objects = Array.isArray(parsed) ? parsed : [parsed];
      for (const object of objects) {
        const spec = object.openingHoursSpecification;
        if (!Array.isArray(spec)) {
          continue;
        }

        for (const entry of spec) {
          const data = entry as Record<string, unknown>;
          const day = Array.isArray(data.dayOfWeek)
            ? String((data.dayOfWeek as unknown[])[0] ?? "")
            : String(data.dayOfWeek ?? "");
          const opens = String(data.opens ?? "").trim();
          const closes = String(data.closes ?? "").trim();
          if (day && opens && closes) {
            hours[day] = `${opens} - ${closes}`;
          }
        }
      }
    } catch {
      // Skip invalid JSON-LD blocks.
    }
  });

  return normalizeHours(hours);
}

function extractHoursFromText(text: string) {
  const hours: Record<string, string> = {};
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[:\s]+(.+)$/i;
  for (const line of lines) {
    const match = line.match(dayPattern);
    if (match) {
      hours[match[1]] = match[2].replace(/\s+/g, " ");
    }
  }

  return normalizeHours(hours);
}

function extractFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

export async function scrapeGoogleBusinessProfile(
  profileUrl: string
): Promise<ScrapedProfileData> {
  const launchOptions: LaunchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 2200 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    await page.goto(profileUrl, {
      waitUntil: "networkidle2",
      timeout: 60_000
    });

    await sleep(2200);

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText || "");
    const $ = cheerio.load(html);

    const ratingRaw =
      extractFirstMatch(text, /([0-9]+\.[0-9]+)\s*(?:stars?|rating)/i) ??
      $("meta[itemprop='ratingValue']").attr("content") ??
      null;

    const reviewCountRaw =
      extractFirstMatch(text, /([0-9][0-9,]*)\s+reviews?/i) ??
      $("meta[itemprop='reviewCount']").attr("content") ??
      null;

    const photosCountRaw = extractFirstMatch(text, /([0-9][0-9,]*)\s+photos?/i);

    const postRaw =
      extractFirstMatch(text, /(Latest|New)\s+post[:\s\n]+([^\n]{20,220})/i) ??
      extractFirstMatch(html, /"postText":"([^"\\]{10,280})"/i);

    const postDateRaw =
      extractFirstMatch(text, /(\d+\s+(?:minute|hour|day|week|month)s?\s+ago)/i) ??
      extractFirstMatch(html, /"publishedAt":"([^"]+)"/i);

    const hoursFromJsonLd = extractHoursFromJsonLd($);
    const hoursFromText = extractHoursFromText(text);

    return {
      sourceUrl: profileUrl,
      capturedAt: new Date().toISOString(),
      hours:
        Object.keys(hoursFromJsonLd).length > 0 ? hoursFromJsonLd : hoursFromText,
      rating: ratingRaw ? parseNumber(ratingRaw) : null,
      reviewCount: reviewCountRaw ? parseNumber(reviewCountRaw) : null,
      photosCount: photosCountRaw ? parseNumber(photosCountRaw) : null,
      latestPostText: postRaw ? postRaw.replace(/\s+/g, " ").trim() : null,
      latestPostDate: postDateRaw ? postDateRaw.trim() : null,
      rawSignals: {
        title: $("title").text().trim() || null,
        snippets: text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 20)
          .slice(0, 30)
      }
    };
  } finally {
    await browser.close();
  }
}

function stableStringify(value: unknown) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  const keys = Object.keys(value as Record<string, unknown>).sort();
  return JSON.stringify(value, keys);
}

export function detectProfileChanges(
  previous: {
    hours: Record<string, string>;
    rating: number | null;
    reviewCount: number | null;
    photosCount: number | null;
    latestPostText: string | null;
  } | null,
  current: {
    hours: Record<string, string>;
    rating: number | null;
    reviewCount: number | null;
    photosCount: number | null;
    latestPostText: string | null;
  }
): ProfileChange[] {
  if (!previous) {
    return [];
  }

  const changes: ProfileChange[] = [];

  const previousHours = normalizeHours(previous.hours ?? {});
  const currentHours = normalizeHours(current.hours ?? {});
  if (stableStringify(previousHours) !== stableStringify(currentHours)) {
    changes.push({
      type: "hours",
      summary: "Business hours were updated.",
      beforeValue: previousHours,
      afterValue: currentHours
    });
  }

  if (previous.rating !== current.rating) {
    changes.push({
      type: "rating",
      summary: `Average rating changed from ${
        previous.rating ?? "unavailable"
      } to ${current.rating ?? "unavailable"}.`,
      beforeValue: previous.rating,
      afterValue: current.rating
    });
  }

  if (previous.reviewCount !== current.reviewCount) {
    const prev = previous.reviewCount ?? 0;
    const next = current.reviewCount ?? 0;
    const delta = next - prev;
    changes.push({
      type: "reviews",
      summary:
        delta >= 0
          ? `Review count increased by ${delta} (${prev} -> ${next}).`
          : `Review count dropped by ${Math.abs(delta)} (${prev} -> ${next}).`,
      beforeValue: previous.reviewCount,
      afterValue: current.reviewCount
    });
  }

  if (previous.photosCount !== current.photosCount) {
    const prev = previous.photosCount ?? 0;
    const next = current.photosCount ?? 0;
    const delta = next - prev;
    changes.push({
      type: "photos",
      summary:
        delta >= 0
          ? `Photo count increased by ${delta} (${prev} -> ${next}).`
          : `Photo count decreased by ${Math.abs(delta)} (${prev} -> ${next}).`,
      beforeValue: previous.photosCount,
      afterValue: current.photosCount
    });
  }

  const prevPost = previous.latestPostText?.trim() ?? "";
  const nextPost = current.latestPostText?.trim() ?? "";
  if (prevPost !== nextPost) {
    changes.push({
      type: "posts",
      summary: "Latest Google post content changed.",
      beforeValue: previous.latestPostText,
      afterValue: current.latestPostText
    });
  }

  return changes;
}
