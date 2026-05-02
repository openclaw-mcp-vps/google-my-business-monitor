import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const hasAccess = request.cookies.get("gmbm_access")?.value === "granted";
  const email = request.cookies.get("gmbm_email")?.value ?? null;

  return NextResponse.json({
    hasAccess,
    email
  });
}
