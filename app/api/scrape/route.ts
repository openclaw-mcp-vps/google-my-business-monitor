import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCompetitorById,
  getLatestSnapshot,
  insertChange,
  insertSnapshot
} from "@/lib/database";
import { sendChangeNotifications } from "@/lib/notifications";
import { detectProfileChanges, scrapeGoogleBusinessProfile } from "@/lib/scraper";

export const runtime = "nodejs";

const scrapeSchema = z.object({
  competitorId: z.number().int().positive()
});

export async function POST(request: NextRequest) {
  try {
    const payload = scrapeSchema.parse(await request.json());
    const ownerEmail = request.cookies.get("gmbm_email")?.value ?? null;

    const competitor = await getCompetitorById(payload.competitorId);
    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    if (ownerEmail && competitor.ownerEmail && competitor.ownerEmail !== ownerEmail) {
      return NextResponse.json(
        { error: "This competitor does not belong to your account" },
        { status: 403 }
      );
    }

    const previousSnapshot = await getLatestSnapshot(competitor.id);
    const latestData = await scrapeGoogleBusinessProfile(competitor.profileUrl);

    const changes = detectProfileChanges(
      previousSnapshot
        ? {
            hours: previousSnapshot.hours,
            rating: previousSnapshot.rating,
            reviewCount: previousSnapshot.reviewCount,
            photosCount: previousSnapshot.photosCount,
            latestPostText: previousSnapshot.latestPostText
          }
        : null,
      {
        hours: latestData.hours,
        rating: latestData.rating,
        reviewCount: latestData.reviewCount,
        photosCount: latestData.photosCount,
        latestPostText: latestData.latestPostText
      }
    );

    const snapshot = await insertSnapshot({
      competitorId: competitor.id,
      hours: latestData.hours,
      rating: latestData.rating,
      reviewCount: latestData.reviewCount,
      photosCount: latestData.photosCount,
      latestPostText: latestData.latestPostText,
      latestPostDate: latestData.latestPostDate,
      rawData: latestData
    });

    if (changes.length > 0) {
      await Promise.all(
        changes.map((change) =>
          insertChange({
            competitorId: competitor.id,
            changeType: change.type,
            summary: change.summary,
            beforeValue: change.beforeValue,
            afterValue: change.afterValue
          })
        )
      );

      await sendChangeNotifications({
        competitor,
        changes,
        target: {
          email: competitor.alertEmail,
          webhookUrl: competitor.alertWebhookUrl
        }
      });
    }

    return NextResponse.json({
      competitor,
      snapshot,
      changes,
      message:
        changes.length === 0
          ? "Scrape complete. No changes detected."
          : `Scrape complete. ${changes.length} change(s) detected.`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: error.flatten()
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Scrape failed",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
