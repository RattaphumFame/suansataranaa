// src/parks/districts.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ParksService } from './parks.service';

@Controller('api/districts')
export class DistrictsController {
  constructor(private readonly parksService: ParksService) {}

  // GET /api/districts - รายชื่อเขต + จำนวนสวนในแต่ละเขต
  @Get()
  findAll() {
    return this.parksService.districts();
  }
}
