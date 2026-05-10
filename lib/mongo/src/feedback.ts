import crypto from "crypto";
import { feedbackAggregates } from "./collections.js";

export interface FeedbackInput {
  aboutUserId: number;
  fromUserId: number;
  rating: number;
  traits: string[];
}

function hashReviewerId(userId: number): string {
  return crypto.createHash("sha256").update(String(userId)).digest("hex");
}

export async function upsertFeedbackAggregate(input: FeedbackInput): Promise<void> {
  const col = feedbackAggregates();
  if (!col) return;

  const hashedId = hashReviewerId(input.fromUserId);
  const existing = await col.findOne({ userId: input.aboutUserId });

  if (!existing) {
    const traitFreq: Record<string, number> = {};
    for (const t of input.traits) {
      traitFreq[t] = 1;
    }
    await col.insertOne({
      userId: input.aboutUserId,
      totalRatings: 1,
      averageRating: input.rating,
      traitFrequency: traitFreq,
      anonymousReviewerCount: 1,
      hashedReviewerIds: [hashedId],
      updatedAt: new Date(),
    });
    return;
  }

  const newTotal = existing.totalRatings + 1;
  const newAvg = (existing.averageRating * existing.totalRatings + input.rating) / newTotal;

  const traitInc: Record<string, number> = {};
  for (const t of input.traits) {
    traitInc[`traitFrequency.${t}`] = 1;
  }

  const alreadyReviewed = existing.hashedReviewerIds.includes(hashedId);

  await col.updateOne(
    { userId: input.aboutUserId },
    {
      $set: {
        totalRatings: newTotal,
        averageRating: Math.round(newAvg * 100) / 100,
        updatedAt: new Date(),
      },
      $inc: {
        ...(alreadyReviewed ? {} : { anonymousReviewerCount: 1 }),
        ...traitInc,
      } as Record<string, number>,
      ...(alreadyReviewed ? {} : { $addToSet: { hashedReviewerIds: hashedId } as Record<string, unknown> }),
    }
  );
}
