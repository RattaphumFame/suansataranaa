// src/parks/parks.controller.ts
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ParksService } from './parks.service';

@Controller('api/parks')
export class ParksController {
  constructor(private readonly parksService: ParksService) {}

  // GET /api/parks?district=เขตจตุจักร&search=ลุม
  // GET /api/parks?lat=13.7563&lng=100.5018   -> เรียงตามระยะทางจากตำแหน่งปัจจุบัน
  // GET /api/parks?district=เขตจตุจักร&lat=..&lng=..  -> กรองตามเขต + เรียงตามระยะทาง
  @Get()
  async findAll(
    @Query('district') district?: string,
    @Query('search') search?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latNum = lat !== undefined ? parseFloat(lat) : undefined;
    const lngNum = lng !== undefined ? parseFloat(lng) : undefined;
    const data = await this.parksService.findAll(district, search, latNum, lngNum);
    return { count: data.length, data };
  }

  // GET /api/parks/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.parksService.findOne(id);
  }
}
