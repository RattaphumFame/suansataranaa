import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ParksService } from './parks.service';

@Controller('parks')
export class ParksController {
  constructor(private readonly parksService: ParksService) {}

  // GET /parks/search              -> สวนสาธารณะทั้งหมด
  // GET /parks/search?district=... -> คัดกรองตามเขตที่เลือก
  @Get('search')
  searchByDistrict(@Query('district') district?: string) {
    return this.parksService.searchByDistrict(district);
  }

  // GET /parks/districts -> รายชื่อเขตทั้งหมด (ใช้ทำ dropdown เลือกเขต)
  @Get('districts')
  getDistricts() {
    return this.parksService.getDistricts();
  }

  // GET /parks/:id -> ดูรายละเอียดสวนสาธารณะทีละแห่ง
  @Get(':id')
  getParkById(@Param('id', ParseIntPipe) id: number) {
    return this.parksService.getParkById(id);
  }
}
