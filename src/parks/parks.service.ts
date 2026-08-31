import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Park } from './park.entity';

@Injectable()
export class ParksService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
  ) {}

  // ==========================================
  // Flow: เลือกเขต -> เรียกข้อมูลจาก MySQL
  //       -> ดึงข้อมูลสำเร็จ? -> คัดกรองตามเขต
  //       -> จัดรูปแบบผลลัพธ์ -> แสดงรายการ
  // ==========================================
  async searchByDistrict(district?: string) {
    let parks: Park[];

    // เรียกข้อมูลจาก MySQL
    try {
      parks = district
        ? await this.parkRepository.find({
            where: { district: Like(`%${district}%`) },
            order: { name: 'ASC' },
          })
        : await this.parkRepository.find({ order: { name: 'ASC' } });
    } catch (error) {
      // ดึงข้อมูลไม่สำเร็จ -> แจ้ง error ให้ frontend ทำปุ่ม "ลองใหม่"
      throw new InternalServerErrorException({
        message: 'ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        error: (error as Error).message,
      });
    }

    // จัดรูปแบบผลลัพธ์
    return {
      total: parks.length,
      district: district ?? 'ทั้งหมด',
      data: parks.map((park) => this.formatPark(park)),
    };
  }

  // ==========================================
  // ดูรายละเอียดสวนสาธารณะทีละแห่ง (เลือกสวนที่สนใจ -> ดูรายละเอียด)
  // ==========================================
  async getParkById(id: number) {
    let park: Park | null;

    try {
      park = await this.parkRepository.findOne({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        error: (error as Error).message,
      });
    }

    if (!park) {
      throw new NotFoundException(`ไม่พบสวนสาธารณะ id=${id}`);
    }

    return this.formatPark(park);
  }

  // ==========================================
  // รายชื่อเขตทั้งหมดที่มีสวนสาธารณะ (ใช้ทำ dropdown เลือกเขต)
  // ==========================================
  async getDistricts() {
    const rows = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.district', 'district')
      .orderBy('park.district', 'ASC')
      .getRawMany();

    return rows.map((row) => row.district);
  }

  // ==========================================
  // จัดรูปแบบผลลัพธ์ให้ frontend ใช้งานง่าย
  // ==========================================
  private formatPark(park: Park) {
    return {
      id: park.id,
      name: park.name,
      district: park.district,
      areaRai: park.rai,
      openTime: park.openTime,
      closeTime: park.closeTime,
      facilities: {
        toilet: park.toilet === '/',
        sportsField: park.sportsField === '/',
        runningTrack: park.runningTrack === '/',
        carPark: park.carPark === '/',
        bicyclePath: park.bicyclePath === '/',
        other: park.otherFacility || null,
      },
    };
  }
}
