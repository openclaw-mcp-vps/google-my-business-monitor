import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createCompetitor,
  deleteCompetitor,
  getChangesByDay,
  getCompetitors,
  getDashboardStats,
  getRecentChanges
} from "@/lib/database";

export const runtime = "nodejs";

const createCompetitorSchema = z.object({
  name: z.string().min(2).max(120),
  profileUrl: z.string().url().refine((url) => url.includes("google"), {
    message: "Use a valid Google Maps or Google Business profile URL."
  }),
  location: z.string().max(120).optional(),
  alertEmail: z.string().email().optional(),
  alertWebhookUrl: z.string().url().optional(),
  checkIntervalMinutes: z.number().int().min(15).max(720).default(60)
});

function getOwnerEmailFromRequest(request: NextRequest) {
  return request.cookies.get("gmbm_email")?.value ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const ownerEmail = getOwnerEmailFromRequest(request);
    const [competitors, changes, stats, daily] = await Promise.all([
      getCompetitors(ownerEmail),
      getRecentChanges(ownerEmail, 80),
      getDashboardStats(ownerEmail),
      getChangesByDay(ownerEmail, 14)
    ]);

    return NextResponse.json({
      competitors,
      changes,
      stats,
      daily
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load competitors",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = createCompetitorSchema.parse(await request.json());
    const ownerEmail = getOwnerEmailFromRequest(request);

    const competitor = await createCompetitor({
      ownerEmail,
      ...payload
    });

    return NextResponse.json({ competitor }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create competitor",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid competitor id" }, { status: 400 });
    }

    const ownerEmail = getOwnerEmailFromRequest(request);
    await deleteCompetitor(id, ownerEmail);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete competitor",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
