import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ParksService } from "./parks.service";

@Controller("parks")
export class ParksController {
  constructor(private readonly parksService: ParksService) {}

  /**
   * GET /parks?district=เขตจตุจักร
   * GET /parks?lat=13.7563&lng=100.5018&radiusKm=5
   * ตรงกับหน้าค้นหาสวนสาธารณะ: เลือกเขต หรือ ใช้ตำแหน่งปัจจุบัน (lat/lng)
   */
  @Get()
  findAll(
    @Query("district") district?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("radiusKm") radiusKm?: string
  ) {
    return this.parksService.findAll(
      district,
      lat !== undefined ? parseFloat(lat) : undefined,
      lng !== undefined ? parseFloat(lng) : undefined,
      radiusKm !== undefined ? parseFloat(radiusKm) : undefined
    );
  }

  /** GET /parks/districts -> ใช้ทำ dropdown "เลือกเขต" ในหน้าค้นหา */
  @Get("districts")
  listDistricts() {
    return this.parksService.listDistricts();
  }

  /** GET /parks/:id -> ตรงกับ "ดูรายละเอียดสวนสาธารณะ" หลังผู้ใช้เลือกสวนที่สนใจ */
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.parksService.findOne(id);
  }
}
