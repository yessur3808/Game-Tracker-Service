import { Module } from "@nestjs/common";
import { SteamProvider } from "./steam.provider";
import { IgdbProvider } from "./igdb.provider";
import { PlayStationProvider } from "./playstation.provider";
import { XboxProvider } from "./xbox.provider";
import { NintendoProvider } from "./nintendo.provider";
import { EpicProvider } from "./epic.provider";

@Module({
  providers: [
    SteamProvider,
    IgdbProvider,
    PlayStationProvider,
    XboxProvider,
    NintendoProvider,
    EpicProvider,
  ],
  exports: [
    SteamProvider,
    IgdbProvider,
    PlayStationProvider,
    XboxProvider,
    NintendoProvider,
    EpicProvider,
  ],
})
export class ProvidersModule {}
