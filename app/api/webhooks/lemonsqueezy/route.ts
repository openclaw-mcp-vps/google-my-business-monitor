import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { markPaidCustomer } from "@/lib/database";

export const runtime = "nodejs";

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const items = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const timestamp = items.t;
  const expectedSignature = items.v1;

  if (!timestamp || !expectedSignature) {
    return false;
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const computedBuffer = Buffer.from(computed, "utf8");

  if (expectedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Initializes the LemonSqueezy SDK for future extension while Stripe is the active checkout provider.
  if (process.env.LEMONSQUEEZY_API_KEY) {
    lemonSqueezySetup({
      apiKey: process.env.LEMONSQUEEZY_API_KEY
    });
  }

  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSignature = request.headers.get("stripe-signature");

  if (stripeSecret) {
    if (!stripeSignature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const valid = verifyStripeSignature(rawBody, stripeSignature, stripeSecret);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const email =
      session?.customer_details?.email ??
      session?.customer_email ??
      session?.metadata?.email ??
      null;

    if (!email) {
      return NextResponse.json(
        { error: "No customer email present in checkout session" },
        { status: 400 }
      );
    }

    await markPaidCustomer({
      email,
      source: "stripe",
      stripeCustomerId: session?.customer ?? null,
      stripeSessionId: session?.id ?? null
    });
  }

  return NextResponse.json({ received: true });
}
