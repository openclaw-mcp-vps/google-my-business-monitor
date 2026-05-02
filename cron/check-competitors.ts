import { CronJob } from "cron";
import {
  getCompetitorById,
  getCompetitorsDueForCheck,
  getLatestSnapshot,
  insertChange,
  insertSnapshot
} from "../lib/database";
import { sendChangeNotifications } from "../lib/notifications";
import { detectProfileChanges, scrapeGoogleBusinessProfile } from "../lib/scraper";

async function checkCompetitor(competitorId: number) {
  const competitor = await getCompetitorById(competitorId);
  if (!competitor || !competitor.isActive) {
    return { competitorId, changes: 0 };
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

  await insertSnapshot({
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

  return { competitorId, changes: changes.length };
}

async function runHourlyChecks() {
  const startedAt = new Date();
  console.log(`[cron] check run started ${startedAt.toISOString()}`);

  const competitors = await getCompetitorsDueForCheck();
  console.log(`[cron] checking ${competitors.length} competitor(s)`);

  let totalChanges = 0;

  for (const competitor of competitors) {
    try {
      const result = await checkCompetitor(competitor.id);
      totalChanges += result.changes;
      console.log(
        `[cron] checked competitor=${competitor.id} changes=${result.changes}`
      );
    } catch (error) {
      console.error(`[cron] failed competitor=${competitor.id}`, error);
    }
  }

  console.log(
    `[cron] check run completed ${new Date().toISOString()} total_changes=${totalChanges}`
  );
}

if (process.env.CRON_ONESHOT === "1") {
  runHourlyChecks()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[cron] fatal error", error);
      process.exit(1);
    });
} else {
  const job = new CronJob("0 * * * *", () => {
    void runHourlyChecks();
  });

  job.start();
  console.log("[cron] scheduler started. Running every hour at minute 0.");

  void runHourlyChecks();
}
