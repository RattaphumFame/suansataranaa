/**
 * โหลดข้อมูล "สวนสาธารณะ" เข้า MySQL
 * ตรงกับขั้นตอน "เรียกข้อมูลจาก Open Data API ของ กทม." ในโฟลว์ชาร์ต
 *
 * แหล่งข้อมูล 2 ทาง (เลือกอัตโนมัติ):
 *   1) Open Data API ของกรุงเทพมหานคร (data.bangkok.go.th)
 *      - เว็บนี้เป็น CKAN ให้บริการ Data API แบบ datastore_search
 *      - ต้องตั้งค่า PARK_RESOURCE_ID เป็น resource_id ของชุดข้อมูล
 *        "ที่ตั้งสวนสาธารณะของกรุงเทพมหานคร" (ไปเอาได้จากหน้า
 *        https://data.bangkok.go.th/dataset -> ค้นหา "สวนสาธารณะ" -> เปิดทรัพยากร
 *        -> จะเห็น resource_id ในกล่อง "Data API" ของหน้านั้น)
 *      - ตัวอย่างเรียก: https://data.bangkok.go.th/api/3/action/datastore_search?resource_id=<ID>&limit=1000
 *   2) ถ้าไม่ได้ตั้งค่า PARK_RESOURCE_ID หรือเรียก API ไม่สำเร็จ (เครือข่าย/API ล่ม)
 *      -> ใช้ไฟล์สำรอง data/parks_seed.json แทน (ข้อมูลสวนสาธารณะจริงในกรุงเทพฯ
 *         เก็บรวบรวมไว้ล่วงหน้า ใช้เดโมโปรเจกต์ได้ทันทีโดยไม่ต้องพึ่ง API ภายนอก)
 *
 * วิธีใช้:
 * 1. npm install
 * 2. สร้างฐานข้อมูลก่อน (รันใน mysql shell ครั้งเดียว):
 *    CREATE DATABASE bkk_parks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 * 3. แก้ DB_CONFIG ด้านล่างให้ตรงกับเครื่องของคุณ
 * 4. (ถ้ามี resource_id จริง) ตั้งค่า env PARK_RESOURCE_ID=<resource_id>
 * 5. รัน: node load_parks_to_mysql.js
 *    สคริปต์รันซ้ำได้ ไม่เกิดข้อมูลซ้ำ (ใช้ ON DUPLICATE KEY UPDATE)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// ---------- ตั้งค่าการเชื่อมต่อ MySQL (อ่านจาก .env) ----------
const DB_CONFIG = {
  ...(process.env.DB_SOCKET_PATH
    ? { socketPath: process.env.DB_SOCKET_PATH }
    : { host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT) || 3306 }),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "bkk_parks",
  charset: "utf8mb4_unicode_ci",
};

// ---------- ตั้งค่า Open Data API ของ กทม. ----------
const OPEN_DATA_BASE_URL = "https://data.bangkok.go.th/api/3/action/datastore_search";
const PARK_RESOURCE_ID = process.env.PARK_RESOURCE_ID || "";

const SEED_FILE = path.join(__dirname, "data", "parks_seed.json");

const CREATE_TABLE_SQL = `
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
`;

const UPSERT_SQL = `
INSERT INTO parks (source_id, name, district, address, lat, lng, area_rai, facilities, image_url, detail_url)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    district = VALUES(district),
    address = VALUES(address),
    lat = VALUES(lat),
    lng = VALUES(lng),
    area_rai = VALUES(area_rai),
    facilities = VALUES(facilities),
    image_url = VALUES(image_url),
    detail_url = VALUES(detail_url);
`;

/** พยายามดึงข้อมูลจาก Open Data API ของ กทม. คืนค่า null ถ้าเรียกไม่สำเร็จ (ไม่ throw) */
async function fetchFromOpenData() {
  if (!PARK_RESOURCE_ID) {
    console.log("  (ไม่ได้ตั้งค่า PARK_RESOURCE_ID -> ข้ามการเรียก Open Data API)");
    return null;
  }
  try {
    const url = `${OPEN_DATA_BASE_URL}?resource_id=${encodeURIComponent(PARK_RESOURCE_ID)}&limit=1000`;
    console.log(`  กำลังเรียก Open Data API: ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !Array.isArray(body.result?.records)) {
      throw new Error("รูปแบบข้อมูลที่ตอบกลับไม่ตรงตามที่คาดไว้");
    }
    // field ของแต่ละชุดข้อมูลบน data.bangkok.go.th อาจตั้งชื่อคอลัมน์ไม่เหมือนกัน
    // ปรับ mapping ตรงนี้ให้ตรงกับชุดข้อมูลจริงที่ใช้
    return body.result.records.map((r, i) => ({
      source_id: String(r.id ?? r._id ?? `api-${i}`),
      name: r.park_name ?? r.name ?? r.NAME ?? "",
      district: r.district ?? r.DISTRICT ?? r.dname ?? "",
      address: r.address ?? "",
      lat: parseFloat(r.lat ?? r.latitude ?? r.LAT),
      lng: parseFloat(r.lng ?? r.long ?? r.longitude ?? r.LONG),
      area_rai: r.area_rai ? parseFloat(r.area_rai) : null,
      facilities: r.facilities ?? "",
      image_url: r.image_url ?? null,
      detail_url: r.detail_url ?? null,
    }));
  } catch (err) {
    console.warn(`  ! เรียก Open Data API ไม่สำเร็จ: ${err.message}`);
    return null;
  }
}

/** ใช้ไฟล์สำรอง data/parks_seed.json */
function loadFromSeedFile() {
  console.log(`  ใช้ไฟล์สำรอง: ${SEED_FILE}`);
  const raw = fs.readFileSync(SEED_FILE, "utf-8");
  const records = JSON.parse(raw);
  return records.map((r) => ({
    source_id: r.source_id,
    name: r.name,
    district: r.district,
    address: r.address ?? "",
    lat: r.lat,
    lng: r.lng,
    area_rai: r.area_rai ?? null,
    facilities: r.facilities ?? "",
    image_url: r.image_url ?? null,
    detail_url: r.detail_url ?? null,
  }));
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  await conn.query(CREATE_TABLE_SQL);

  console.log("กำลังดึงข้อมูลสวนสาธารณะ...");
  let rows = await fetchFromOpenData();
  let source = "Open Data API ของ กทม.";
  if (!rows) {
    rows = loadFromSeedFile();
    source = "ไฟล์สำรอง data/parks_seed.json";
  }

  for (const row of rows) {
    await conn.execute(UPSERT_SQL, [
      row.source_id,
      row.name,
      row.district,
      row.address,
      row.lat,
      row.lng,
      row.area_rai,
      row.facilities,
      row.image_url,
      row.detail_url,
    ]);
  }

  console.log(`โหลดข้อมูลสวนสาธารณะเข้า MySQL สำเร็จ ${rows.length} รายการ (แหล่งข้อมูล: ${source})`);
  await conn.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err);
  process.exit(1);
});
