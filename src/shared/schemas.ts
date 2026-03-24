import { z } from "zod";

export const SourceSchema = z.object({
  type: z.enum([
    "official_site",
    "press_release",
    "platform_store",
    "youtube",
    "twitter_x",
    "discord",
    "gaming_news",
    "gaming_blog",
    "forum",
    "reddit",
    "other",
  ]),
  name: z.string().min(1),
  /** Optional — some sources have no direct URL */
  url: z.string().url().optional(),
  isOfficial: z.boolean(),
  reliability: z.enum(["high", "medium", "low", "unknown"]),
  /** ISO-8601 timestamp of when this source was last retrieved */
  retrievedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, { message: "retrievedAt must be ISO-8601" })
    .optional(),
  excerpt: z.string().max(2000).optional(),
  claim: z.string().max(1000).optional(),
  authorHandle: z.string().optional(),
  /** Credibility score 1 (least) – 100 (most); optional, curator-assigned */
  credibilityScore: z.number().int().min(1).max(100).optional(),
  /** ISO-8601 timestamp of the last automated health-check of this source URL */
  lastCheckedAt: z.string().optional(),
  /** How many times this source has been verified / re-scraped */
  checkCount: z.number().int().min(0).optional(),
});

export const CategorySchema = z.object({
  type: z.enum([
    "full_game",
    "dlc",
    "season",
    "event",
    "update",
    "store_reset",
    "other",
  ]),
  subtype: z.string().optional(),
  franchise: z.string().optional(),
  label: z.string().optional(),
  /** Season-specific — used when type === "season" */
  gameId: z.string().optional(),
  seasonNumber: z.number().int().positive().optional(),
  seasonName: z.string().optional(),
});

export const ReleaseSchema = z
  .object({
    status: z.enum([
      "announced",
      "upcoming",
      "released",
      "delayed",
      "canceled",
      "unknown",
      "recurring_daily",
      "recurring_weekly",
    ]),
    isOfficial: z.boolean(),
    confidence: z.enum(["official", "likely", "rumor", "unknown"]),
    dateISO: z.string().optional(),
    datePrecision: z
      .enum(["day", "month", "quarter", "year", "unknown"])
      .optional(),
    announced_window: z
      .object({
        label: z.string(),
        year: z.number().int().optional(),
        quarter: z
          .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
          .optional(),
        month: z
          .union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
            z.literal(6),
            z.literal(7),
            z.literal(8),
            z.literal(9),
            z.literal(10),
            z.literal(11),
            z.literal(12),
          ])
          .optional(),
      })
      .optional(),
    /** UTC time "HH:MM" — required when status is recurring_daily or recurring_weekly */
    timeUTC: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { message: 'timeUTC must be in "HH:MM" format' })
      .optional(),
    /** Day of week 0=Sun…6=Sat — required when status is recurring_weekly */
    dayOfWeekUTC: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
      ])
      .optional(),
    sources: z.array(SourceSchema),
  })
  .superRefine((r, ctx) => {
    if (r.status === "released" && !r.dateISO) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'release.dateISO is required when release.status is "released".',
        path: ["dateISO"],
      });
    }
    if (r.status === "recurring_daily" && !r.timeUTC) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'release.timeUTC is required when release.status is "recurring_daily".',
        path: ["timeUTC"],
      });
    }
    if (r.status === "recurring_weekly") {
      if (!r.timeUTC) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'release.timeUTC is required when release.status is "recurring_weekly".',
          path: ["timeUTC"],
        });
      }
      if (r.dayOfWeekUTC === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'release.dayOfWeekUTC is required when release.status is "recurring_weekly".',
          path: ["dayOfWeekUTC"],
        });
      }
    }
  });

export const StudioSchema = z.object({
  name: z.string().nullable(),
  type: z.enum(["developer", "publisher", "developer_publisher", "unknown"]),
  website: z.string().url().optional(),
  description: z.string().optional(),
  parentCompany: z.string().optional(),
});

export const ImageAssetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("url"),
    url: z.string().url(),
    mime: z.string().optional(),
  }),
  z.object({
    kind: z.literal("base64"),
    mime: z.string().min(1),
    data: z.string().min(1),
  }),
]);

export const MediaSchema = z.object({
  cover: ImageAssetSchema.optional(),
  coverUrl: z.string().url().optional(),
  trailers: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        source: SourceSchema.optional(),
      }),
    )
    .optional(),
});

/** Cross-references to external platform IDs for deduplication */
export const ExternalIdsSchema = z
  .object({
    steam: z.number().int().positive().optional(),
    igdb: z.number().int().positive().optional(),
    epic: z.string().optional(),
    playstation: z.string().optional(),
    xbox: z.string().optional(),
    nintendo: z.string().optional(),
  })
  .optional();

export const GameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional(),
  /** Short description of the game */
  description: z.string().max(5000).optional(),
  category: CategorySchema,
  platforms: z.array(z.string().min(1)).default([]),
  availability: z.enum(["upcoming", "released", "cancelled", "unknown"]),
  release: ReleaseSchema,
  seasonWindow: z
    .object({
      current: z
        .object({
          startISO: z.string().optional(),
          endISO: z.string().optional(),
          label: z.string().optional(),
          isOfficial: z.boolean().optional(),
          confidence: z
            .enum(["confirmed", "likely", "estimate", "unknown"])
            .optional(),
          sources: z.array(SourceSchema).optional(),
        })
        .optional(),
    })
    .optional(),
  studio: StudioSchema.optional(),
  media: MediaSchema.optional(),
  coverUrl: z.string().url().optional(),
  popularityTier: z
    .enum([
      "blockbuster",
      "very_popular_live_service",
      "popular",
      "niche",
      "unknown_or_rumor",
    ])
    .optional(),
  popularityRank: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1)).optional(),
  /** Genre tags (e.g. ["Action", "RPG"]) */
  genres: z.array(z.string().min(1)).optional(),
  sources: z.array(SourceSchema),
  /** External platform IDs for cross-referencing / deduplication */
  externalIds: ExternalIdsSchema,
  updatedAt: z.string().optional(),
});

export type GameInput = z.infer<typeof GameSchema>;
