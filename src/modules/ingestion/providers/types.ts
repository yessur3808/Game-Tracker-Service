export type ProviderKey =
  | "steam"
  | "igdb"
  | "epic"
  | "playstation"
  | "xbox"
  | "nintendo";

export type ProviderResult = {
  provider: ProviderKey;
  fetchedAt: string;

  // reference
  url?: string;
  externalId?: string | number;

  // extracted fields (best-effort)
  name?: string | null;
  releaseText?: string | null;
  releaseDateISO?: string | null;

  platforms?: string[]; // e.g. ["pc","ps5"]
  coverUrl?: string | null;
};
