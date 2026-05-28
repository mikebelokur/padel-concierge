import { db, clubsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface SeedClub {
  name: string;
  address: string;
  area: string;
  phone: string;
  lat: number;
  lng: number;
  tier: string;
  website?: string;
  notes?: string;
}

const PREMIUM_CLUBS: SeedClub[] = [
  {
    name: "Padel Edition",
    address: "Al Wasl Rd, Jumeirah 1, Dubai",
    area: "Jumeirah",
    phone: "+971 4 343 7777",
    lat: 25.2306,
    lng: 55.2647,
    tier: "premium",
    website: "https://padeledition.com",
    notes: "Премиум-клуб у моря. 4 закрытых корта, кафе.",
  },
  {
    name: "Padel 700",
    address: "Al Quoz, Dubai",
    area: "Al Quoz",
    phone: "+971 4 700 7000",
    lat: 25.1361,
    lng: 55.2360,
    tier: "premium",
    website: "https://padel700.ae",
    notes: "6 кортов. Профессиональное освещение.",
  },
  {
    name: "Padel 360",
    address: "Dubai Sports City, Dubai",
    area: "Sports City",
    phone: "+971 4 360 3600",
    lat: 25.0427,
    lng: 55.2227,
    tier: "premium",
    website: "https://padel360.com",
    notes: "Стеклянные корты 360°.",
  },
  {
    name: "Padel One",
    address: "Business Bay, Dubai",
    area: "Business Bay",
    phone: "+971 4 100 0100",
    lat: 25.1857,
    lng: 55.2762,
    tier: "premium",
    notes: "Центральная локация. 4 крытых корта.",
  },
  {
    name: "Pause Padel",
    address: "Al Khawaneej, Dubai",
    area: "Al Khawaneej",
    phone: "+971 4 200 2002",
    lat: 25.1972,
    lng: 55.4178,
    tier: "premium",
    notes: "Тихий клуб для серьёзных игроков.",
  },
];

export async function seedClubsIfEmpty(): Promise<void> {
  try {
    for (const c of PREMIUM_CLUBS) {
      const existing = await db.select().from(clubsTable).where(eq(clubsTable.name, c.name));
      if (existing.length > 0) continue;
      await db.insert(clubsTable).values({
        name: c.name,
        address: c.address,
        area: c.area,
        phone: c.phone,
        lat: c.lat,
        lng: c.lng,
        tier: c.tier,
        website: c.website ?? null,
        notes: c.notes ?? null,
        active: true,
      });
      logger.info({ club: c.name }, "Seeded premium club");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to seed premium clubs (table may not yet exist)");
  }
}
