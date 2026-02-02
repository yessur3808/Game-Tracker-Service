import { z } from "zod";

export const SourceSchema = z.object({
  type: z.enum([
    "official_site",
    "press_release",
    "platform_store",
    "youtube",
    "other",
  ]),
  name: z.string().min(1),
  url: z.string().url(),
  isOfficial: z.boolean(),
  reliability: z.enum(["high", "medium", "low"]),
  retrievedAt: z.string().min(1),
  excerpt: z.string().optional(),
  claim: z.string().optional(),
});

export const CategorySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("full_game") }),
  z.object({ type: z.literal("dlc") }),
  z.object({
    type: z.literal("season"),
    gameId: z.string().optional(),
    seasonNumber: z.number().int().positive().optional(),
    seasonName: z.string().optional(),
  }),
  z.object({ type: z.literal("event") }),
  z.object({ type: z.literal("update") }),
  z.object({ type: z.literal("store_reset") }),
]);

export const ReleaseSchema = z.object({
  status: z.enum([
    "announced",
    "upcoming",
    "released",
    "delayed",
    "canceled",
    "unknown",
  ]),
  isOfficial: z.boolean(),
  confidence: z.enum(["official", "likely", "rumor"]),
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
  sources: z.array(SourceSchema),
});

export const GameSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: CategorySchema,
    platforms: z.array(z.string().min(1)).default([]),
    availability: z.enum(["upcoming", "released", "unknown"]),
    release: ReleaseSchema,
    seasonWindow: z
      .object({
        current: z
          .object({
            startISO: z.string().optional(),
            endISO: z.string().optional(),
            label: z.string().optional(),
            sources: z.array(SourceSchema).optional(),
          })
          .optional(),
      })
      .optional(),
    popularityRank: z.number().int().positive().optional(),
    tags: z.array(z.string()).optional(),
    sources: z.array(SourceSchema),
    updatedAt: z.string().optional(),
  })
  .superRefine((g, ctx) => {
    if (g.release.status === "released" && !g.release.dateISO) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'release.dateISO is required when release.status is "released".',
        path: ["release", "dateISO"],
      });
    }
  });

export type GameInput = z.infer<typeof GameSchema>;
