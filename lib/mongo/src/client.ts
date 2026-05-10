import { MongoClient, type Db } from "mongodb";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

let client: MongoClient | null = null;
let db: Db | null = null;
let connected = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectMongoDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const c = new MongoClient(uri);
      await c.connect();
      client = c;
      db = c.db();
      connected = true;
      console.log("[mongo] connected");
      await ensureIndexes(db);
      return;
    } catch (err) {
      const msg = (err as Error).message;
      if (attempt < MAX_RETRIES) {
        console.error(`[mongo] connect attempt ${attempt}/${MAX_RETRIES} failed: ${msg} — retrying in ${RETRY_DELAY_MS}ms`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error(`[mongo] all ${MAX_RETRIES} connect attempts failed — MongoDB features will be disabled: ${msg}`);
        client = null;
        db = null;
        connected = false;
      }
    }
  }
}

async function ensureIndexes(database: Db): Promise<void> {
  try {
    await database.collection("compatibility_scores").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );
    await database.collection("compatibility_scores").createIndex({ pairKey: 1 }, { unique: true });
    await database.collection("player_profiles").createIndex({ userId: 1 }, { unique: true });
    await database.collection("feedback_aggregates").createIndex({ userId: 1 }, { unique: true });
    await database.collection("match_logs").createIndex({ matchId: 1 }, { unique: true });
    console.log("[mongo] indexes ensured");
  } catch (err) {
    console.error("[mongo] index creation warning:", (err as Error).message);
  }
}

export function getMongoDb(): Db | null {
  return db;
}

export function isMongoConnected(): boolean {
  return connected;
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    connected = false;
  }
}
