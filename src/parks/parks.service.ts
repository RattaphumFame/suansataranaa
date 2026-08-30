// src/parks/parks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Park } from './entities/park.entity';

export interface ParkWithDistance extends Park {
  distance_km?: number;
}

@Injectable()
export class ParksService {
  constructor(
    @InjectRepository(Park)
    private readonly parksRepository: Repository<Park>,
  ) {}

  /**
   * ค้นหาสวนสาธารณะ
   * - district: กรองตามเขต (ตรงจากที่ผู้ใช้เลือกในหน้าค้นหา)
   * - search: ค้นหาจากชื่อสวน
   * - lat/lng: ตำแหน่งปัจจุบันของผู้ใช้ ถ้าระบุมาจะคำนวณระยะทาง (กม.)
   *   และจัดเรียงจากใกล้ไปไกล เฉพาะสวนที่มีพิกัดในฐานข้อมูลเท่านั้น
   *   (ตาม flow: เลือกเขต/ตำแหน่งปัจจุบัน -> คัดกรอง -> จัดเรียงตามระยะทาง)
   */
  async findAll(
    district?: string,
    search?: string,
    lat?: number,
    lng?: number,
  ): Promise<ParkWithDistance[]> {
    const where: Record<string, any> = {};
    if (district) where.district = district;
    if (search) where.name = Like(`%${search}%`);

    const parks = await this.parksRepository.find({
      where,
      order: { name: 'ASC' },
    });

    if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
      return parks;
    }

    // จัดรูปแบบผลลัพธ์ + คำนวณระยะทาง แล้วเรียงจากใกล้ที่สุด
    const withDistance: ParkWithDistance[] = parks.map((p) => ({
      ...p,
      distance_km:
        p.latitude != null && p.longitude != null
          ? this.haversineKm(lat, lng, Number(p.latitude), Number(p.longitude))
          : undefined,
    }));

    withDistance.sort((a, b) => {
      if (a.distance_km === undefined) return 1;
      if (b.distance_km === undefined) return -1;
      return a.distance_km - b.distance_km;
    });

    return withDistance;
  }

  async findOne(id: number): Promise<Park> {
    const park = await this.parksRepository.findOne({ where: { id } });
    if (!park) throw new NotFoundException('ไม่พบสวนสาธารณะนี้');
    return park;
  }

  async districts(): Promise<{ district: string; park_count: number }[]> {
    return this.parksRepository
      .createQueryBuilder('park')
      .select('park.district', 'district')
      .addSelect('COUNT(*)', 'park_count')
      .groupBy('park.district')
      .orderBy('park.district', 'ASC')
      .getRawMany();
  }

  // สูตร Haversine: ระยะทางตรง (กม.) ระหว่างพิกัด 2 จุดบนโลก
  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // รัศมีโลก (กม.)
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // ปัดทศนิยม 2 ตำแหน่ง
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
