export type ISODateTime = string; // store ISO strings

export type Source = {
  type:
    | "official_site"
    | "press_release"
    | "platform_store"
    | "youtube"
    | "other";
  name: string;
  url: string;
  isOfficial: boolean;
  reliability: "high" | "medium" | "low";
  retrievedAt: ISODateTime;
  excerpt?: string;
  claim?: string;
};

export type DatePrecision = "day" | "month" | "quarter" | "year" | "unknown";

export type ReleaseStatus =
  | "announced"
  | "upcoming"
  | "released"
  | "delayed"
  | "canceled"
  | "unknown";

export type ReleaseConfidence = "official" | "likely" | "rumor";

export type Release = {
  status: ReleaseStatus;
  isOfficial: boolean;
  confidence: ReleaseConfidence;
  dateISO?: string; // required when released
  datePrecision?: DatePrecision;
  announced_window?: {
    label: string;
    year?: number;
    quarter?: 1 | 2 | 3 | 4;
    month?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  };
  sources: Source[];
};

export type Category =
  | { type: "full_game" }
  | { type: "dlc" }
  | {
      type: "season";
      gameId?: string;
      seasonNumber?: number;
      seasonName?: string;
    }
  | { type: "event" }
  | { type: "update" }
  | { type: "store_reset" };

export type SeasonWindow = {
  current?: {
    startISO?: string;
    endISO?: string;
    label?: string;
    sources?: Source[];
  };
};

export type Media = {
  coverUrl?: string;
  trailers?: { title: string; url: string; source?: Source }[];
};

export type Game = {
  id: string;
  name: string;

  category: Category;
  platforms: string[]; // e.g. ["PC","PS5"]
  availability: "upcoming" | "released" | "unknown";

  release: Release;

  seasonWindow?: SeasonWindow;

  popularityRank?: number;
  tags?: string[];

  sources: Source[];

  updatedAt?: ISODateTime; // filled by DB layer
};
