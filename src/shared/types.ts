export type ISODateTime = string; // store ISO strings

export type Source = {
  type:
    | "official_site"
    | "press_release"
    | "platform_store"
    | "youtube"
    | "twitter_x"
    | "discord"
    | "gaming_news"
    | "gaming_blog"
    | "forum"
    | "reddit"
    | "other";
  name: string;
  /** Optional — some sources (e.g. verbal press releases) have no URL */
  url?: string;
  isOfficial: boolean;
  reliability: "high" | "medium" | "low" | "unknown";
  /** Optional — not always recorded at ingestion time */
  retrievedAt?: ISODateTime;
  excerpt?: string;
  claim?: string;
  /** For social sources — e.g. "@FortniteGame" */
  authorHandle?: string;
};

export type DatePrecision = "day" | "month" | "quarter" | "year" | "unknown";

export type ReleaseStatus =
  | "announced"
  | "upcoming"
  | "released"
  | "delayed"
  | "canceled"
  | "unknown"
  /** Happens every day at a known UTC time — pair with timeUTC */
  | "recurring_daily"
  /** Happens every week at a known UTC time — pair with dayOfWeekUTC + timeUTC */
  | "recurring_weekly";

export type ReleaseConfidence = "official" | "likely" | "rumor" | "unknown";

export type Release = {
  status: ReleaseStatus;
  isOfficial: boolean;
  confidence: ReleaseConfidence;
  dateISO?: string; // required when status === "released"
  datePrecision?: DatePrecision;
  announced_window?: {
    label: string;
    year?: number;
    quarter?: 1 | 2 | 3 | 4;
    month?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  };
  /** UTC time "HH:MM" — required when status is "recurring_daily" or "recurring_weekly" */
  timeUTC?: string;
  /** Day of week 0=Sun…6=Sat — required when status is "recurring_weekly" */
  dayOfWeekUTC?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  sources: Source[];
};

export type CategoryType =
  | "full_game"
  | "dlc"
  | "season"
  | "event"
  | "update"
  | "store_reset"
  | "other";

export type Category = {
  type: CategoryType;
  /** Optional free-form sub-classifier */
  subtype?: string;
  /** Optional franchise / series grouping */
  franchise?: string;
  /** Optional display-label override */
  label?: string;
  /** Season-specific — applicable when type === "season" */
  gameId?: string;
  seasonNumber?: number;
  seasonName?: string;
};

export type SeasonWindow = {
  current?: {
    startISO?: string;
    endISO?: string;
    label?: string;
    /** Whether the season boundaries are confirmed by an official source */
    isOfficial?: boolean;
    confidence?: "confirmed" | "likely" | "estimate" | "unknown";
    sources?: Source[];
  };
};

export type StudioType =
  | "developer"
  | "publisher"
  | "developer_publisher"
  | "unknown";

export type Studio = {
  /** Studio name; null allowed for rumors/unknown studios */
  name: string | null;
  type: StudioType;
  website?: string;
  description?: string;
  parentCompany?: string;
};

export type ImageAsset =
  | { kind: "url"; url: string; mime?: string }
  | { kind: "base64"; mime: string; data: string };

export type Media = {
  cover?: ImageAsset;
  /** Back-compat with earlier consumers (prefer media.cover) */
  coverUrl?: string;
  trailers?: { title: string; url: string; source?: Source }[];
};

export type PopularityTier =
  | "blockbuster"
  | "very_popular_live_service"
  | "popular"
  | "niche"
  | "unknown_or_rumor";

export type Game = {
  id: string;
  name: string;
  /** Canonical title — useful when name is a specific release item */
  title?: string;

  category: Category;
  platforms: string[]; // e.g. ["PC","PS5"]
  availability: "upcoming" | "released" | "cancelled" | "unknown";

  release: Release;

  seasonWindow?: SeasonWindow;

  studio?: Studio;
  media?: Media;
  /** Back-compat with earlier consumers (prefer media.cover) */
  coverUrl?: string;

  popularityTier?: PopularityTier;
  popularityRank?: number;
  tags?: string[];

  sources: Source[];

  updatedAt?: ISODateTime; // filled by DB layer
};
