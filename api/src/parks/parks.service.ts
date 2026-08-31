import { Injectable, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import * as mysql from "mysql2/promise";

interface ParkRow {
  id: number;
  source_id: string;
  name: string;
  district: string;
  address: string;
  lat: string | number;
  lng: string | number;
  area_rai: string | number | null;
  facilities: string | null;
  image_url: string | null;
  detail_url: string | null;
}

/**
 * ดึงข้อมูลสวนสาธารณะจาก MySQL โดยตรงเสมอ (ไม่มีการอ่านไฟล์ในเครื่อง เช่น
 * data/parks_seed.json หรือเรียก network ภายนอกใดๆ ในตอน request)
 * ข้อมูลตั้งต้นต้องถูกโหลดเข้า MySQL ไว้ล่วงหน้าด้วย load_parks_to_mysql.js
 * (รันครั้งเดียวตอน setup โปรเจกต์ ไม่เกี่ยวกับตอนเสิร์ฟ request)
 */
@Injectable()
export class ParksService implements OnModuleDestroy {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      socketPath: process.env.DB_SOCKET_PATH || undefined,
      host: process.env.DB_SOCKET_PATH ? undefined : process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "bkk_parks",
      charset: "utf8mb4_unicode_ci",
      connectionLimit: 5,
    });
    this.ensureTable();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async ensureTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS parks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        district VARCHAR(100),
        address TEXT,
        lat DECIMAL(10,7),
        lng DECIMAL(10,7),
        area_rai DECIMAL(10,2) DEFAULT NULL,
        facilities TEXT,
        image_url VARCHAR(500) DEFAULT NULL,
        detail_url VARCHAR(500) DEFAULT NULL,
        UNIQUE KEY uniq_source (source_id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
  }

  /**
   * รัน query กับ MySQL — ตรงกับขั้นตอน "ดึงข้อมูลจาก MySQL" + "ดึงข้อมูลสำเร็จ?" ใน
   * โฟลว์ชาร์ต ถ้าเชื่อมต่อ/query ไม่สำเร็จ (เช่น MySQL ล่ม) จะโยน 503 ให้ controller
   * ตอบกลับพร้อมข้อความ error (ฝั่ง frontend ใช้แสดงปุ่ม "ลองใหม่" ได้)
   */
  private async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const [rows] = await this.pool.query(sql, params);
      return rows as T[];
    } catch (err) {
      throw new ServiceUnavailableException(
        "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      );
    }
  }

  /** ระยะทางแบบ Haversine หน่วยกิโลเมตร */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private formatRow(row: ParkRow, distanceKm: number | null) {
    return {
      id: row.id,
      name: row.name,
      district: row.district,
      address: row.address,
      coordinates: {
        lat: Number(row.lat),
        lng: Number(row.lng),
      },
      areaRai: row.area_rai !== null ? Number(row.area_rai) : null,
      facilities: row.facilities ? row.facilities.split(",").map((f) => f.trim()).filter(Boolean) : [],
      imageUrl: row.image_url,
      detailUrl: row.detail_url,
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
    };
  }

  /**
   * GET /parks?district=เขตจตุจักร&lat=13.75&lng=100.5&radiusKm=5
   * ตรงกับขั้นตอน "เลือกเขต หรือ ตำแหน่งปัจจุบัน" -> "ดึงข้อมูลจาก MySQL" ->
   * "คัดกรองตามเขต/ระยะทางที่เลือก" -> "จัดเรียงตามระยะทางจากใกล้ที่สุด" ->
   * "จัดรูปแบบผลลัพธ์" ในโฟลว์ชาร์ต
   */
  async findAll(district?: string, lat?: number, lng?: number, radiusKm?: number) {
    let sql = "SELECT * FROM parks WHERE 1=1";
    const params: any[] = [];
    if (district) {
      sql += " AND district = ?";
      params.push(district);
    }
    const results = await this.query<ParkRow>(sql, params);

    const hasLocation = typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);

    let formatted = results.map((row) => {
      const distanceKm = hasLocation ? this.haversineKm(lat!, lng!, Number(row.lat), Number(row.lng)) : null;
      return this.formatRow(row, distanceKm);
    });

    if (hasLocation && radiusKm) {
      formatted = formatted.filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm);
    }

    if (hasLocation) {
      // จัดเรียงตามระยะทางจากใกล้ที่สุด
      formatted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      // ไม่มีพิกัด -> เรียงตามชื่อ ก-ฮ
      formatted.sort((a, b) => a.name.localeCompare(b.name, "th"));
    }

    return formatted;
  }

  /** GET /parks/districts -> รายชื่อเขตที่มีสวนสาธารณะ ใช้ทำ dropdown "เลือกเขต" */
  async listDistricts() {
    return this.query(
      "SELECT district, COUNT(*) AS count FROM parks GROUP BY district ORDER BY district"
    );
  }

  /** GET /parks/:id -> ตรงกับ "ดูรายละเอียดสวนสาธารณะ" หลังผู้ใช้เลือกสวนที่สนใจ */
  async findOne(id: number) {
    const list = await this.query<ParkRow>("SELECT * FROM parks WHERE id = ?", [id]);
    if (list.length === 0) return null;
    return this.formatRow(list[0], null);
  }
}
