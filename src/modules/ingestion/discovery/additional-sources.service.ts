import { Injectable, Logger } from "@nestjs/common";
import { fetchJsonWithRetry, fetchTextWithRetry } from "../providers/http.util";

export type AdditionalDiscoverySource = {
  name: string;
  provider: string;
  category: "media" | "store" | "publisher" | "event" | "creator" | "community" | "social" | "tool";
  strategy: "api" | "rss" | "html" | "social" | "none";
  endpoint?: string;
};

/**
 * Registry for additional discovery sources requested by product.
 *
 * This service currently registers and exposes all sources so they are visible in
 * discovery logs and orchestration. Individual scraping/API implementations can be
 * added incrementally per provider key.
 */
@Injectable()
export class AdditionalSourcesService {
  private readonly logger = new Logger(AdditionalSourcesService.name);

  private readonly sources: AdditionalDiscoverySource[] = [
    { name: "Steam Upcoming Releases", provider: "steam-upcoming", category: "store", strategy: "api", endpoint: "https://store.steampowered.com/api/featuredcategories" },
    { name: "SteamDB Calendar", provider: "steamdb-calendar", category: "store", strategy: "html", endpoint: "https://steamdb.info/upcoming/" },
    { name: "Nintendo eShop (Coming Soon)", provider: "nintendo-eshop-coming-soon", category: "store", strategy: "html", endpoint: "https://www.nintendo.com/us/store/games/" },
    { name: "PlayStation Blog", provider: "playstation-blog", category: "media", strategy: "rss", endpoint: "https://blog.playstation.com/feed/" },
    { name: "Xbox Wire", provider: "xbox-wire", category: "media", strategy: "rss", endpoint: "https://news.xbox.com/en-us/feed/" },
    { name: "Nintendo Official News", provider: "nintendo-news", category: "media", strategy: "html", endpoint: "https://www.nintendo.com/us/whatsnew/" },
    { name: "Nintendo Direct Recaps", provider: "nintendo-direct-recaps", category: "event", strategy: "html", endpoint: "https://www.nintendo.com/nintendo-direct/" },
    { name: "Epic Games Store Coming Soon", provider: "epic-coming-soon", category: "store", strategy: "html", endpoint: "https://store.epicgames.com/en-US/browse?sortBy=releaseDate&sortDir=ASC&category=Game" },
    { name: "IGN", provider: "ign-media", category: "media", strategy: "rss", endpoint: "https://www.ign.com/rss" },
    { name: "IGN (Upcoming Games Section)", provider: "ign-upcoming-section", category: "media", strategy: "html", endpoint: "https://www.ign.com/upcoming/games" },
    { name: "GameSpot", provider: "gamespot", category: "media", strategy: "rss", endpoint: "https://www.gamespot.com/feeds/news/" },
    { name: "GameSpot (GameSpot 50)", provider: "gamespot-50", category: "media", strategy: "html", endpoint: "https://www.gamespot.com/gallery/gamespot-50-most-anticipated-games/" },
    { name: "Gematsu", provider: "gematsu-media", category: "media", strategy: "rss", endpoint: "https://www.gematsu.com/feed" },
    { name: "Metacritic Upcoming Releases", provider: "metacritic-upcoming", category: "media", strategy: "html", endpoint: "https://www.metacritic.com/browse/game/" },
    { name: "Metacritic (News section)", provider: "metacritic-news", category: "media", strategy: "html", endpoint: "https://www.metacritic.com/news/" },
    { name: "PC Gamer", provider: "pc-gamer", category: "media", strategy: "rss", endpoint: "https://www.pcgamer.com/rss/" },
    { name: "GamesRadar+", provider: "gamesradar-media", category: "media", strategy: "rss", endpoint: "https://www.gamesradar.com/rss/" },
    { name: "Eurogamer", provider: "eurogamer", category: "media", strategy: "rss", endpoint: "https://www.eurogamer.net/rss" },
    { name: "Polygon", provider: "polygon", category: "media", strategy: "rss", endpoint: "https://www.polygon.com/rss/index.xml" },
    { name: "Game Informer", provider: "game-informer", category: "media", strategy: "rss", endpoint: "https://www.gameinformer.com/rss.xml" },
    { name: "Gameranx (Top 10 New Games)", provider: "gameranx-top10", category: "creator", strategy: "html", endpoint: "https://gameranx.com/" },
    { name: "VG247", provider: "vg247", category: "media", strategy: "rss", endpoint: "https://www.vg247.com/feed" },
    { name: "Destructoid", provider: "destructoid", category: "media", strategy: "rss", endpoint: "https://www.destructoid.com/feed/" },
    { name: "Shacknews", provider: "shacknews", category: "media", strategy: "rss", endpoint: "https://www.shacknews.com/feed" },
    { name: "Rock Paper Shotgun", provider: "rock-paper-shotgun", category: "media", strategy: "rss", endpoint: "https://www.rockpapershotgun.com/feed" },
    { name: "Kotaku", provider: "kotaku", category: "media", strategy: "rss", endpoint: "https://kotaku.com/rss" },
    { name: "DualShockers", provider: "dualshockers", category: "media", strategy: "rss", endpoint: "https://www.dualshockers.com/feed/" },
    { name: "GOG", provider: "gog", category: "store", strategy: "html", endpoint: "https://www.gog.com/en/games?sort=release_date" },
    { name: "Humble Store", provider: "humble-store", category: "store", strategy: "html", endpoint: "https://www.humblebundle.com/store/search?sort=bestselling&hmb_source=navbar" },
    { name: "itch.io", provider: "itch-io", category: "store", strategy: "html", endpoint: "https://itch.io/games/upcoming" },
    { name: "Green Man Gaming", provider: "green-man-gaming", category: "store", strategy: "html", endpoint: "https://www.greenmangaming.com/new-release/" },
    { name: "Fanatical", provider: "fanatical", category: "store", strategy: "html", endpoint: "https://www.fanatical.com/en/new-releases" },
    { name: "Ubisoft Official News/Store", provider: "ubisoft-official", category: "publisher", strategy: "html", endpoint: "https://news.ubisoft.com/" },
    { name: "EA Official News", provider: "ea-official", category: "publisher", strategy: "html", endpoint: "https://www.ea.com/news" },
    { name: "Bandai Namco Official Pages", provider: "bandai-namco-official", category: "publisher", strategy: "html", endpoint: "https://www.bandainamcoent.com/news" },
    { name: "Square Enix Official Pages", provider: "square-enix-official", category: "publisher", strategy: "html", endpoint: "https://www.square-enix-games.com/en_GB/news" },
    { name: "Capcom Official Pages", provider: "capcom-official", category: "publisher", strategy: "html", endpoint: "https://www.capcom-games.com/en-us/" },
    { name: "Push Square", provider: "push-square", category: "media", strategy: "rss", endpoint: "https://www.pushsquare.com/feeds/latest" },
    { name: "PlayStation Store", provider: "playstation-store", category: "store", strategy: "html", endpoint: "https://store.playstation.com/" },
    { name: "TrueTrophies", provider: "truetrophies", category: "media", strategy: "html", endpoint: "https://www.truetrophies.com/news" },
    { name: "TheSixthAxis", provider: "thesixthaxis", category: "media", strategy: "rss", endpoint: "https://www.thesixthaxis.com/feed/" },
    { name: "PlayStation Universe", provider: "playstation-universe", category: "media", strategy: "html", endpoint: "https://www.psu.com/news/" },
    { name: "Pure Xbox", provider: "pure-xbox", category: "media", strategy: "rss", endpoint: "https://www.purexbox.com/feeds/latest" },
    { name: "TrueAchievements", provider: "trueachievements", category: "media", strategy: "html", endpoint: "https://www.trueachievements.com/news" },
    { name: "Xbox Store", provider: "xbox-store", category: "store", strategy: "html", endpoint: "https://www.xbox.com/en-US/games/store" },
    { name: "Windows Central Gaming", provider: "windows-central-gaming", category: "media", strategy: "rss", endpoint: "https://www.windowscentral.com/feed" },
    { name: "Xbox Game Pass News", provider: "xbox-game-pass-news", category: "media", strategy: "html", endpoint: "https://news.xbox.com/en-us/xbox-game-pass/" },
    { name: "Nintendo Life", provider: "nintendo-life", category: "media", strategy: "rss", endpoint: "https://www.nintendolife.com/feeds/latest" },
    { name: "My Nintendo News", provider: "my-nintendo-news", category: "media", strategy: "rss", endpoint: "https://mynintendonews.com/feed/" },
    { name: "Nintendo Everything", provider: "nintendo-everything", category: "media", strategy: "rss", endpoint: "https://nintendoeverything.com/feed/" },
    { name: "Nintendo eShop / Game Pages", provider: "nintendo-eshop-pages", category: "store", strategy: "html", endpoint: "https://www.nintendo.com/us/store/games/" },
    { name: "GoNintendo", provider: "gonintendo", category: "media", strategy: "rss", endpoint: "https://www.gonintendo.com/stories.rss" },
    { name: "Summer Game Fest", provider: "summer-game-fest", category: "event", strategy: "html", endpoint: "https://www.summergamefest.com/" },
    { name: "The Game Awards", provider: "the-game-awards", category: "event", strategy: "html", endpoint: "https://thegameawards.com/news" },
    { name: "Future Games Show", provider: "future-games-show", category: "event", strategy: "html", endpoint: "https://www.gamesradar.com/future-games-show/" },
    { name: "Gamescom", provider: "gamescom", category: "event", strategy: "html", endpoint: "https://www.gamescom.global/en/news" },
    { name: "ID@Xbox Recap Hub", provider: "id-at-xbox-recaps", category: "event", strategy: "html", endpoint: "https://news.xbox.com/en-us/tag/idxbox/" },
    { name: "Indie World Recap Hub", provider: "indie-world-recaps", category: "event", strategy: "html", endpoint: "https://www.nintendo.com/us/nintendo-direct/archive/" },
    { name: "State of Play Recap Hub", provider: "state-of-play-recaps", category: "event", strategy: "html", endpoint: "https://blog.playstation.com/tag/state-of-play/" },
    { name: "Nintendo Direct Hub", provider: "nintendo-direct-hub", category: "event", strategy: "html", endpoint: "https://www.nintendo.com/nintendo-direct/" },
    { name: "SplatterCatGaming", provider: "splattercatgaming", category: "creator", strategy: "none" },
    { name: "ClemmyGames", provider: "clemmygames", category: "creator", strategy: "none" },
    { name: "GameTrailers/GameNewsOfficial", provider: "gametrailers-gamenewsofficial", category: "creator", strategy: "none" },
    { name: "Mortismal Gaming", provider: "mortismal-gaming", category: "creator", strategy: "none" },
    { name: "ACG", provider: "acg", category: "creator", strategy: "none" },
    { name: "Reddit r/Games", provider: "reddit-r-games", category: "community", strategy: "rss", endpoint: "https://www.reddit.com/r/Games/.rss" },
    { name: "Reddit r/PCGaming", provider: "reddit-r-pcgaming", category: "community", strategy: "rss", endpoint: "https://www.reddit.com/r/pcgaming/.rss" },
    { name: "Wario64 (Twitter)", provider: "wario64-twitter", category: "social", strategy: "social" },
    { name: "Geoff Keighley (Twitter)", provider: "geoff-keighley-twitter", category: "social", strategy: "social" },
    { name: "Video Game Insights", provider: "video-game-insights", category: "tool", strategy: "html", endpoint: "https://vginsights.com/" },
    { name: "Opera GX Corner", provider: "opera-gx-corner", category: "tool", strategy: "html", endpoint: "https://gx.games/news/" },
  ];

  getConfiguredSources(): AdditionalDiscoverySource[] {
    const unique = new Map<string, AdditionalDiscoverySource>();
    for (const source of this.sources) {
      if (!unique.has(source.provider)) {
        unique.set(source.provider, source);
      }
    }
    return Array.from(unique.values());
  }

  async fetchUpcoming(provider: string, limit: number): Promise<Array<{ externalId: string; name: string }>> {
    const source = this.getConfiguredSources().find((s) => s.provider === provider);
    if (!source) {
      this.logger.warn(`Additional source ${provider} not configured`);
      return [];
    }

    try {
      if (source.strategy === "api") {
        return this.fetchFromApi(source, limit);
      }
      if (source.strategy === "rss") {
        return this.fetchFromRss(source, limit);
      }

      this.logger.debug(
        `Additional source ${provider} is registered with strategy ${source.strategy} and awaits custom parser implementation`,
      );
      return [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Additional source ${provider} fetch failed: ${msg}`);
      return [];
    }
  }

  private async fetchFromApi(
    source: AdditionalDiscoverySource,
    limit: number,
  ): Promise<Array<{ externalId: string; name: string }>> {
    if (!source.endpoint) {
      return [];
    }

    if (source.provider === "steam-upcoming") {
      const payload = await fetchJsonWithRetry<any>(source.endpoint, {
        headers: {
          "User-Agent": "GameTracker/1.0",
        },
      }, this.logger);

      const items = Array.isArray(payload?.coming_soon?.items)
        ? payload.coming_soon.items
        : [];

      return items
        .filter((item: any) => typeof item?.id === "number" || typeof item?.id === "string")
        .slice(0, limit)
        .map((item: any) => ({
          externalId: String(item.id),
          name: String(item?.name || `Steam ${item.id}`),
        }));
    }

    return [];
  }

  private async fetchFromRss(
    source: AdditionalDiscoverySource,
    limit: number,
  ): Promise<Array<{ externalId: string; name: string }>> {
    if (!source.endpoint) {
      return [];
    }

    const xml = await fetchTextWithRetry(source.endpoint, {
      headers: {
        "User-Agent": "GameTracker/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    }, this.logger);

    const itemTitles = this.extractRssTitles(xml).slice(0, limit);
    return itemTitles.map((title, idx) => ({
      externalId: `${source.provider}-${this.slugify(title)}-${idx}`,
      name: title,
    }));
  }

  private extractRssTitles(xml: string): string[] {
    const titles: string[] = [];
    const itemRegex = /<item\b[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const raw = match[1] ?? "";
      const cleaned = raw
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, "")
        .trim();

      if (!cleaned || cleaned.length < 3) {
        continue;
      }

      titles.push(cleaned);
    }

    return titles;
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }
}
