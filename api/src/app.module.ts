import { Module } from "@nestjs/common";
import { ParksModule } from "./parks/parks.module";

@Module({
  imports: [ParksModule],
})
export class AppModule {}
