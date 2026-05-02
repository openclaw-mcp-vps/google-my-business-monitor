import { Pool } from "pg";

export type Competitor = {
  id: number;
  ownerEmail: string | null;
  name: string;
  profileUrl: string;
  location: string | null;
  alertEmail: string | null;
  alertWebhookUrl: string | null;
  isActive: boolean;
  checkIntervalMinutes: number;
  lastCheckedAt: string | null;
  lastChangeAt: string | null;
  createdAt: string;
};

export type CompetitorSnapshot = {
  id: number;
  competitorId: number;
  capturedAt: string;
  hours: Record<string, string>;
  rating: number | null;
  reviewCount: number | null;
  photosCount: number | null;
  latestPostText: string | null;
  latestPostDate: string | null;
  rawData: unknown;
};

export type CompetitorChange = {
  id: number;
  competitorId: number;
  competitorName: string;
  changeType: string;
  summary: string;
  beforeValue: unknown;
  afterValue: unknown;
  detectedAt: string;
};

export type CompetitorWithLatest = Competitor & {
  latestSnapshot: CompetitorSnapshot | null;
};

export type DashboardStats = {
  totalCompetitors: number;
  activeCompetitors: number;
  checksLast24h: number;
  changesLast7d: number;
};

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/google_my_business_monitor";

const globalForDb = globalThis as unknown as {
  gmbmPool?: Pool;
  gmbmSchemaInit?: Promise<void>;
};

const pool =
  globalForDb.gmbmPool ??
  new Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000
  });

if (!globalForDb.gmbmPool) {
  globalForDb.gmbmPool = pool;
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS paid_customers (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL DEFAULT 'stripe',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      stripe_customer_id TEXT,
      stripe_session_id TEXT,
      last_payment_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS competitors (
      id BIGSERIAL PRIMARY KEY,
      owner_email TEXT,
      name TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      location TEXT,
      alert_email TEXT,
      alert_webhook_url TEXT,
      check_interval_minutes INT NOT NULL DEFAULT 60,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_checked_at TIMESTAMPTZ,
      last_change_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_email, profile_url)
    );

    CREATE TABLE IF NOT EXISTS competitor_snapshots (
      id BIGSERIAL PRIMARY KEY,
      competitor_id BIGINT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hours_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      rating NUMERIC(4,2),
      review_count INT,
      photos_count INT,
      latest_post_text TEXT,
      latest_post_date TIMESTAMPTZ,
      raw_json JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS competitor_changes (
      id BIGSERIAL PRIMARY KEY,
      competitor_id BIGINT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      before_value JSONB,
      after_value JSONB,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_competitors_owner_email ON competitors(owner_email);
    CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);
    CREATE INDEX IF NOT EXISTS idx_snapshots_competitor_time ON competitor_snapshots(competitor_id, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_changes_competitor_time ON competitor_changes(competitor_id, detected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_changes_detected_at ON competitor_changes(detected_at DESC);
  `);
}

async function ensureSchema() {
  if (!globalForDb.gmbmSchemaInit) {
    globalForDb.gmbmSchemaInit = initSchema();
  }
  await globalForDb.gmbmSchemaInit;
}

function mapCompetitor(row: Record<string, unknown>): Competitor {
  return {
    id: Number(row.id),
    ownerEmail: (row.owner_email as string | null) ?? null,
    name: String(row.name),
    profileUrl: String(row.profile_url),
    location: (row.location as string | null) ?? null,
    alertEmail: (row.alert_email as string | null) ?? null,
    alertWebhookUrl: (row.alert_webhook_url as string | null) ?? null,
    isActive: Boolean(row.is_active),
    checkIntervalMinutes: Number(row.check_interval_minutes),
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    lastChangeAt: (row.last_change_at as string | null) ?? null,
    createdAt: String(row.created_at)
  };
}

function mapSnapshot(row: Record<string, unknown>): CompetitorSnapshot {
  return {
    id: Number(row.id),
    competitorId: Number(row.competitor_id),
    capturedAt: String(row.captured_at),
    hours: (row.hours_json as Record<string, string>) ?? {},
    rating: row.rating === null ? null : Number(row.rating),
    reviewCount: row.review_count === null ? null : Number(row.review_count),
    photosCount: row.photos_count === null ? null : Number(row.photos_count),
    latestPostText: (row.latest_post_text as string | null) ?? null,
    latestPostDate: (row.latest_post_date as string | null) ?? null,
    rawData: row.raw_json ?? {}
  };
}

export async function getCompetitors(ownerEmail?: string | null) {
  await ensureSchema();

  const params: unknown[] = [];
  let whereClause = "";

  if (ownerEmail) {
    whereClause = "WHERE owner_email = $1";
    params.push(ownerEmail);
  }

  const competitors = await pool.query(
    `SELECT * FROM competitors ${whereClause} ORDER BY created_at DESC`,
    params
  );

  if (competitors.rowCount === 0) {
    return [] as CompetitorWithLatest[];
  }

  const snapshots = await pool.query(
    `SELECT DISTINCT ON (competitor_id) *
     FROM competitor_snapshots
     WHERE competitor_id = ANY($1)
     ORDER BY competitor_id, captured_at DESC`,
    [competitors.rows.map((row) => row.id)]
  );

  const latestByCompetitor = new Map<number, CompetitorSnapshot>();
  for (const snapshot of snapshots.rows) {
    latestByCompetitor.set(Number(snapshot.competitor_id), mapSnapshot(snapshot));
  }

  return competitors.rows.map((row) => {
    const competitor = mapCompetitor(row);
    return {
      ...competitor,
      latestSnapshot: latestByCompetitor.get(competitor.id) ?? null
    };
  }) as CompetitorWithLatest[];
}

export async function createCompetitor(input: {
  ownerEmail?: string | null;
  name: string;
  profileUrl: string;
  location?: string | null;
  alertEmail?: string | null;
  alertWebhookUrl?: string | null;
  checkIntervalMinutes?: number;
}) {
  await ensureSchema();

  const inserted = await pool.query(
    `INSERT INTO competitors (
      owner_email,
      name,
      profile_url,
      location,
      alert_email,
      alert_webhook_url,
      check_interval_minutes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (owner_email, profile_url)
    DO UPDATE SET
      name = EXCLUDED.name,
      location = EXCLUDED.location,
      alert_email = EXCLUDED.alert_email,
      alert_webhook_url = EXCLUDED.alert_webhook_url,
      check_interval_minutes = EXCLUDED.check_interval_minutes,
      updated_at = NOW()
    RETURNING *`,
    [
      input.ownerEmail ?? null,
      input.name,
      input.profileUrl,
      input.location ?? null,
      input.alertEmail ?? null,
      input.alertWebhookUrl ?? null,
      input.checkIntervalMinutes ?? 60
    ]
  );

  return mapCompetitor(inserted.rows[0]);
}

export async function deleteCompetitor(id: number, ownerEmail?: string | null) {
  await ensureSchema();

  if (ownerEmail) {
    await pool.query("DELETE FROM competitors WHERE id = $1 AND owner_email = $2", [
      id,
      ownerEmail
    ]);
    return;
  }

  await pool.query("DELETE FROM competitors WHERE id = $1", [id]);
}

export async function getCompetitorById(id: number) {
  await ensureSchema();

  const result = await pool.query("SELECT * FROM competitors WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return null;
  }

  return mapCompetitor(result.rows[0]);
}

export async function getLatestSnapshot(competitorId: number) {
  await ensureSchema();

  const result = await pool.query(
    `SELECT * FROM competitor_snapshots
     WHERE competitor_id = $1
     ORDER BY captured_at DESC
     LIMIT 1`,
    [competitorId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapSnapshot(result.rows[0]);
}

export async function insertSnapshot(input: {
  competitorId: number;
  hours: Record<string, string>;
  rating: number | null;
  reviewCount: number | null;
  photosCount: number | null;
  latestPostText: string | null;
  latestPostDate: string | null;
  rawData: unknown;
}) {
  await ensureSchema();

  const inserted = await pool.query(
    `INSERT INTO competitor_snapshots (
      competitor_id,
      hours_json,
      rating,
      review_count,
      photos_count,
      latest_post_text,
      latest_post_date,
      raw_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      input.competitorId,
      input.hours,
      input.rating,
      input.reviewCount,
      input.photosCount,
      input.latestPostText,
      input.latestPostDate,
      input.rawData
    ]
  );

  await pool.query("UPDATE competitors SET last_checked_at = NOW() WHERE id = $1", [
    input.competitorId
  ]);

  return mapSnapshot(inserted.rows[0]);
}

export async function insertChange(input: {
  competitorId: number;
  changeType: string;
  summary: string;
  beforeValue: unknown;
  afterValue: unknown;
}) {
  await ensureSchema();

  const inserted = await pool.query(
    `INSERT INTO competitor_changes (
      competitor_id,
      change_type,
      summary,
      before_value,
      after_value
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      input.competitorId,
      input.changeType,
      input.summary,
      input.beforeValue,
      input.afterValue
    ]
  );

  await pool.query("UPDATE competitors SET last_change_at = NOW() WHERE id = $1", [
    input.competitorId
  ]);

  return inserted.rows[0];
}

export async function getRecentChanges(ownerEmail?: string | null, limit = 100) {
  await ensureSchema();

  const params: unknown[] = [limit];
  let where = "";

  if (ownerEmail) {
    where = "WHERE c.owner_email = $2";
    params.push(ownerEmail);
  }

  const result = await pool.query(
    `SELECT
      cc.id,
      cc.competitor_id,
      c.name AS competitor_name,
      cc.change_type,
      cc.summary,
      cc.before_value,
      cc.after_value,
      cc.detected_at
    FROM competitor_changes cc
    JOIN competitors c ON c.id = cc.competitor_id
    ${where}
    ORDER BY cc.detected_at DESC
    LIMIT $1`,
    params
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    competitorId: Number(row.competitor_id),
    competitorName: String(row.competitor_name),
    changeType: String(row.change_type),
    summary: String(row.summary),
    beforeValue: row.before_value,
    afterValue: row.after_value,
    detectedAt: String(row.detected_at)
  })) as CompetitorChange[];
}

export async function getDashboardStats(ownerEmail?: string | null): Promise<DashboardStats> {
  await ensureSchema();

  const ownerFilter = ownerEmail ? "WHERE owner_email = $1" : "";
  const ownerParams = ownerEmail ? [ownerEmail] : [];

  const total = await pool.query(
    `SELECT COUNT(*)::int AS value FROM competitors ${ownerFilter}`,
    ownerParams
  );

  const active = await pool.query(
    `SELECT COUNT(*)::int AS value FROM competitors ${
      ownerEmail ? "WHERE owner_email = $1 AND is_active = TRUE" : "WHERE is_active = TRUE"
    }`,
    ownerParams
  );

  const checks = await pool.query(
    `SELECT COUNT(*)::int AS value
     FROM competitor_snapshots s
     JOIN competitors c ON c.id = s.competitor_id
     WHERE s.captured_at >= NOW() - INTERVAL '24 hours'
     ${ownerEmail ? "AND c.owner_email = $1" : ""}`,
    ownerParams
  );

  const changes = await pool.query(
    `SELECT COUNT(*)::int AS value
     FROM competitor_changes cc
     JOIN competitors c ON c.id = cc.competitor_id
     WHERE cc.detected_at >= NOW() - INTERVAL '7 days'
     ${ownerEmail ? "AND c.owner_email = $1" : ""}`,
    ownerParams
  );

  return {
    totalCompetitors: total.rows[0]?.value ?? 0,
    activeCompetitors: active.rows[0]?.value ?? 0,
    checksLast24h: checks.rows[0]?.value ?? 0,
    changesLast7d: changes.rows[0]?.value ?? 0
  };
}

export async function getChangesByDay(ownerEmail?: string | null, days = 14) {
  await ensureSchema();

  const params: unknown[] = [days];
  let ownerWhere = "";

  if (ownerEmail) {
    params.push(ownerEmail);
    ownerWhere = "AND c.owner_email = $2";
  }

  const result = await pool.query(
    `SELECT
      TO_CHAR(DATE_TRUNC('day', cc.detected_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS count
    FROM competitor_changes cc
    JOIN competitors c ON c.id = cc.competitor_id
    WHERE cc.detected_at >= NOW() - ($1 * INTERVAL '1 day')
    ${ownerWhere}
    GROUP BY DATE_TRUNC('day', cc.detected_at)
    ORDER BY DATE_TRUNC('day', cc.detected_at) ASC`,
    params
  );

  return result.rows.map((row) => ({
    day: String(row.day),
    count: Number(row.count)
  }));
}

export async function getCompetitorsDueForCheck() {
  await ensureSchema();

  const result = await pool.query(
    `SELECT *
     FROM competitors
     WHERE is_active = TRUE
       AND (
         last_checked_at IS NULL
         OR NOW() - last_checked_at > (check_interval_minutes::text || ' minutes')::interval
       )
     ORDER BY last_checked_at ASC NULLS FIRST
     LIMIT 200`
  );

  return result.rows.map(mapCompetitor);
}

export async function markPaidCustomer(input: {
  email: string;
  source?: string;
  stripeCustomerId?: string | null;
  stripeSessionId?: string | null;
}) {
  await ensureSchema();

  await pool.query(
    `INSERT INTO paid_customers (
      email,
      source,
      active,
      stripe_customer_id,
      stripe_session_id,
      last_payment_at
    ) VALUES ($1, $2, TRUE, $3, $4, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      active = TRUE,
      source = EXCLUDED.source,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, paid_customers.stripe_customer_id),
      stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, paid_customers.stripe_session_id),
      last_payment_at = NOW()`,
    [
      input.email.trim().toLowerCase(),
      input.source ?? "stripe",
      input.stripeCustomerId ?? null,
      input.stripeSessionId ?? null
    ]
  );
}

export async function hasPaidAccess(email: string) {
  await ensureSchema();

  const result = await pool.query(
    `SELECT id FROM paid_customers WHERE email = $1 AND active = TRUE`,
    [email.trim().toLowerCase()]
  );

  return (result.rowCount ?? 0) > 0;
}
