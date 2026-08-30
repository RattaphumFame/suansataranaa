// src/parks/parks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Park } from './entities/park.entity';
import { ParksController } from './parks.controller';
import { DistrictsController } from './districts.controller';
import { ParksService } from './parks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Park])],
  controllers: [ParksController, DistrictsController],
  providers: [ParksService],
})
export class ParksModule {}
