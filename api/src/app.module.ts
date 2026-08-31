import { Module } from "@nestjs/common";
import { AttractionsModule } from "./attractions/attractions.module";
import { ParksModule } from "./parks/parks.module";

@Module({
  imports: [AttractionsModule, ParksModule],
})
export class AppModule {}
