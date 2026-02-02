import { Global, Module } from "@nestjs/common";
import * as dotenv from "dotenv";

@Global()
@Module({})
export class ConfigModule {
  constructor() {
    dotenv.config();
  }
}
