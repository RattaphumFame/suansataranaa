import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParksController } from './parks.controller';
import { ParksService } from './parks.service';
import { Park } from './park.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Park])],
  controllers: [ParksController],
  providers: [ParksService],
})
export class ParksModule {}
