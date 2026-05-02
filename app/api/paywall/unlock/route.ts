import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasPaidAccess } from "@/lib/database";

export const runtime = "nodejs";

const unlockSchema = z.object({
  email: z.string().email()
});

export async function POST(request: NextRequest) {
  try {
    const payload = unlockSchema.parse(await request.json());
    const email = payload.email.trim().toLowerCase();

    const paid = await hasPaidAccess(email);
    if (!paid) {
      return NextResponse.json(
        {
          error:
            "No active subscription found for this email yet. If you just paid, wait a minute and try again."
        },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("gmbm_access", "granted", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });

    response.cookies.set("gmbm_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Unable to unlock access",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
