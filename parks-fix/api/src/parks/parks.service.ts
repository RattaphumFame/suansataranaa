import { Injectable, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import * as mysql from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";

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

@Injectable()
export class ParksService implements OnModuleDestroy {
  private pool: mysql.Pool;

  // ตั้งค่า Open Data API ของ กทม. (CKAN datastore_search)
  // ดู resource_id ได้จากหน้า dataset "ที่ตั้งสวนสาธารณะของกรุงเทพมหานคร" บน data.bangkok.go.th
  private readonly OPEN_DATA_URL = "https://data.bangkok.go.th/api/3/action/datastore_search";
  private readonly RESOURCE_ID = process.env.PARK_RESOURCE_ID || "";

  // หาไฟล์สำรอง data/parks_seed.json แบบไม่ผูกกับ __dirname (ซึ่งเปลี่ยนตำแหน่งได้ระหว่าง
  // ts-node dev mode กับ dist/ ตอน build จริง) — ลองไล่จาก cwd ขึ้นไปจนกว่าจะเจอโฟลเดอร์ data/
  private readonly SEED_FILE = ParksService.resolveSeedFile();

  private static resolveSeedFile(): string {
    const envPath = process.env.PARK_SEED_FILE;
    if (envPath && fs.existsSync(envPath)) return envPath;

    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
      const candidate = path.join(dir, "data", "parks_seed.json");
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // ไม่เจอ -> คืน path ที่คาดไว้ที่สุด (relative กับ cwd) ให้ error message ตอนอ่านไฟล์บอกตำแหน่งที่ลองหา
    return path.join(process.cwd(), "data", "parks_seed.json");
  }

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
   * ตรงกับขั้นตอน "เรียกข้อมูลจาก Open Data API ของ กทม." + "ดึงข้อมูลสำเร็จ?" ในโฟลว์ชาร์ต
   * - ถ้าตั้งค่า PARK_RESOURCE_ID ไว้ จะเรียก Open Data API จริงทุกครั้งที่ค้นหา แล้ว sync เข้า MySQL
   * - ถ้าเรียกไม่สำเร็จ (และ MySQL ยังไม่มีข้อมูลเลย) -> ถือว่า "ดึงข้อมูลไม่สำเร็จ"
   * - ถ้าไม่ได้ตั้งค่า resource_id -> ใช้ข้อมูลใน MySQL ที่มีอยู่ (โหลดไว้ล่วงหน้าด้วย load_parks_to_mysql.js)
   *   ถ้ายังไม่เคยโหลดเลย จะ bootstrap จากไฟล์สำรอง data/parks_seed.json ให้อัตโนมัติ
   */
  private async syncFromOpenData(): Promise<void> {
    if (this.RESOURCE_ID) {
      try {
        const url = `${this.OPEN_DATA_URL}?resource_id=${encodeURIComponent(this.RESOURCE_ID)}&limit=1000`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body: any = await res.json();
        if (!body.success || !Array.isArray(body.result?.records)) {
          throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");
        }
        const rows = body.result.records.map((r: any, i: number) => ({
          source_id: String(r.id ?? r._id ?? `api-${i}`),
          name: r.park_name ?? r.name ?? "",
          district: r.district ?? "",
          address: r.address ?? "",
          lat: parseFloat(r.lat ?? r.latitude),
          lng: parseFloat(r.lng ?? r.long ?? r.longitude),
          area_rai: r.area_rai ? parseFloat(r.area_rai) : null,
          facilities: r.facilities ?? "",
        }));
        await this.upsertRows(rows);
        return;
      } catch (err) {
        // ดึงข้อมูลจาก Open Data API ไม่สำเร็จ -> โยน error ให้ controller แจ้งผู้ใช้ + ปุ่มลองใหม่
        const [existing] = await this.pool.query("SELECT COUNT(*) AS c FROM parks");
        const hasCache = (existing as any[])[0].c > 0;
        if (!hasCache) {
          throw new ServiceUnavailableException(
            "ดึงข้อมูลจาก Open Data API ของ กทม. ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
          );
        }
        // ถ้ามีข้อมูลแคชอยู่แล้วในเครื่อง ยังพอให้บริการต่อได้ (ไม่ตัดผู้ใช้ทิ้งทันที)
        return;
      }
    }

    // ไม่ได้ตั้งค่า resource_id: ใช้ข้อมูลใน MySQL ที่มีอยู่ ถ้ายังไม่มีเลยให้ bootstrap จากไฟล์สำรอง
    const [existing] = await this.pool.query("SELECT COUNT(*) AS c FROM parks");
    if ((existing as any[])[0].c > 0) return;

    try {
      const raw = fs.readFileSync(this.SEED_FILE, "utf-8");
      const records = JSON.parse(raw);
      await this.upsertRows(records);
    } catch (err) {
      throw new ServiceUnavailableException(
        "ดึงข้อมูลสวนสาธารณะไม่สำเร็จ (ไม่ได้ตั้งค่า Open Data API และไม่พบไฟล์ข้อมูลสำรอง) กรุณาลองใหม่อีกครั้ง"
      );
    }
  }

  private async upsertRows(rows: any[]) {
    const sql = `
      INSERT INTO parks (source_id, name, district, address, lat, lng, area_rai, facilities, image_url, detail_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name), district = VALUES(district), address = VALUES(address),
        lat = VALUES(lat), lng = VALUES(lng), area_rai = VALUES(area_rai),
        facilities = VALUES(facilities), image_url = VALUES(image_url), detail_url = VALUES(detail_url);
    `;
    for (const r of rows) {
      await this.pool.execute(sql, [
        r.source_id,
        r.name,
        r.district,
        r.address ?? "",
        r.lat,
        r.lng,
        r.area_rai ?? null,
        r.facilities ?? "",
        r.image_url ?? null,
        r.detail_url ?? null,
      ]);
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
   * ตรงกับขั้นตอน "เลือกเขต หรือ ตำแหน่งปัจจุบัน" -> "คัดกรองตามเขต/ระยะทางที่เลือก"
   * -> "จัดเรียงตามระยะทางจากใกล้ที่สุด" -> "จัดรูปแบบผลลัพธ์" ในโฟลว์ชาร์ต
   */
  async findAll(district?: string, lat?: number, lng?: number, radiusKm?: number) {
    await this.syncFromOpenData(); // เรียก Open Data API ของ กทม. (หรือ sync แคช) — โยน error ถ้าไม่สำเร็จ

    let sql = "SELECT * FROM parks WHERE 1=1";
    const params: any[] = [];
    if (district) {
      sql += " AND district = ?";
      params.push(district);
    }
    const [rows] = await this.pool.query(sql, params);
    let results = rows as ParkRow[];

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
    await this.syncFromOpenData();
    const [rows] = await this.pool.query(
      "SELECT district, COUNT(*) AS count FROM parks GROUP BY district ORDER BY district"
    );
    return rows;
  }

  /** GET /parks/:id -> ตรงกับ "ดูรายละเอียดสวนสาธารณะ" หลังผู้ใช้เลือกสวนที่สนใจ */
  async findOne(id: number) {
    await this.syncFromOpenData(); // เผื่อกรณีเรียกตรงๆ โดยยังไม่เคยมีข้อมูลใน MySQL เลย
    const [rows] = await this.pool.query("SELECT * FROM parks WHERE id = ?", [id]);
    const list = rows as ParkRow[];
    if (list.length === 0) return null;
    return this.formatRow(list[0], null);
  }
}
