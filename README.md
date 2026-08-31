# ระบบค้นหาสวนสาธารณะ (NestJS + MySQL)

ทำตามโฟลว์ชาร์ตที่ให้มา: เลือกเขต/ตำแหน่งปัจจุบัน -> ดึงข้อมูลจาก MySQL
-> สำเร็จ/ไม่สำเร็จ -> คัดกรอง/เรียงตามระยะทาง -> จัดรูปแบบผลลัพธ์ -> แสดงรายการ -> ดูรายละเอียด

**ทุก endpoint ดึงข้อมูลจากตาราง `parks` ใน MySQL โดยตรงเสมอ** ไม่มีการอ่านไฟล์ในเครื่อง
และไม่มีการเรียก Open Data API หรือ network ภายนอกใดๆ เลย — โปรเจกต์นี้ไม่มี seed
file/script ใดๆ มาให้ ผู้ใช้ต้องเตรียมข้อมูลลงตาราง `parks` เอง (เช่น insert ผ่าน mysql
client, import จากระบบอื่น ฯลฯ) ก่อนเริ่มใช้งาน

## โครงสร้างโปรเจกต์
```
.
├── api/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── parks/
│   │       ├── parks.module.ts
│   │       ├── parks.controller.ts
│   │       └── parks.service.ts   <- query MySQL โดยตรง ไม่มี fallback อื่น
│   └── test/
│       ├── haversine.spec.ts
│       └── parks.e2e-spec.ts
├── package.json
├── tsconfig.json
├── jest.config.json
├── .env.example
└── .gitignore
```

## ติดตั้ง
```bash
npm install
```

## ตั้งค่าฐานข้อมูล
```sql
CREATE DATABASE bkk_parks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

ตัวแอปจะสร้างตาราง `parks` ให้อัตโนมัติตอนเริ่มรัน (`CREATE TABLE IF NOT EXISTS`) ด้วยโครงสร้าง:
```sql
CREATE TABLE parks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100),
    address TEXT,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    area_rai DECIMAL(10,2) DEFAULT NULL,
    facilities TEXT,          -- คั่นด้วยจุลภาค เช่น "มีที่จอดรถ,มีห้องน้ำ"
    image_url VARCHAR(500) DEFAULT NULL,
    detail_url VARCHAR(500) DEFAULT NULL,
    UNIQUE KEY uniq_source (source_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
**ผู้ใช้ต้อง insert ข้อมูลสวนสาธารณะลงตารางนี้เอง** ก่อนเรียกใช้ endpoint — ไม่มี seed
file หรือ script มาให้ในโปรเจกต์นี้

## ตั้งค่าการเชื่อมต่อ
```bash
cp .env.example .env
```
แล้วแก้ค่าในไฟล์ `.env` ให้ตรงกับเครื่องคุณ **ห้าม commit ไฟล์ `.env` ขึ้น git เด็ดขาด**
(มี `.gitignore` กันไว้ให้แล้ว)

## รันเซิร์ฟเวอร์
```bash
npm run start:dev
```

## Endpoints
- `GET /parks?district=เขตจตุจักร` — ค้นหาตามเขต
- `GET /parks?lat=13.7563&lng=100.5018&radiusKm=5` — ค้นหาจากตำแหน่งปัจจุบัน เรียงใกล้ไปไกล
  (ใส่ `radiusKm` ถ้าต้องการกรองเฉพาะในรัศมีที่กำหนด)
- `GET /parks/districts` — รายชื่อเขตทั้งหมด พร้อมจำนวนสวน (ใช้ทำ dropdown "เลือกเขต")
- `GET /parks/:id` — รายละเอียดสวนสาธารณะ 1 แห่ง

### ตัวอย่าง response ของ `GET /parks?lat=13.7563&lng=100.5018`
```json
[
  {
    "id": 2,
    "name": "สวนเบญจกิติ",
    "district": "เขตคลองเตย",
    "address": "ถนนรัชดาภิเษก แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร",
    "coordinates": { "lat": 13.7228, "lng": 100.5605 },
    "areaRai": 450,
    "facilities": ["ปั่นจักรยาน", "สวนสำหรับสุนัข", "รองรับผู้พิการ", "มีห้องน้ำ", "มีที่จอดรถ"],
    "imageUrl": null,
    "detailUrl": "https://greener.bangkok.go.th/park/benjakitti-park/",
    "distanceKm": 2.31
  }
]
```

### กรณีดึงข้อมูลจาก MySQL ไม่สำเร็จ (เช่น MySQL ไม่ได้รันอยู่ หรือเชื่อมต่อไม่ได้)
`GET /parks` (และ endpoint อื่นๆ) จะตอบกลับด้วย HTTP 503 พร้อมข้อความภาษาไทย เช่น:
```json
{ "statusCode": 503, "message": "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
```
ฝั่ง frontend ใช้ status นี้แสดง "แจ้ง error + ปุ่มลองใหม่" ตามโฟลว์ชาร์ตได้เลย
(ถ้า query สำเร็จแต่ตาราง `parks` ว่างเปล่า ระบบจะตอบ `200` พร้อม list ว่าง `[]` ตามปกติ
ไม่ถือว่าเป็น error)

## การทดสอบ
```bash
npm test          # unit test (api/test/haversine.spec.ts) — ไม่ต้องมี MySQL
npm run test:e2e  # e2e test (api/test/parks.e2e-spec.ts) — ต้องมี MySQL รันอยู่ + มีข้อมูลในตาราง parks แล้ว
```
- `haversine.spec.ts` เช็คสูตรคำนวณระยะทางล้วนๆ ไม่พึ่ง DB/network
- `parks.e2e-spec.ts` ยิง request จริงผ่าน `ParksModule` ครบทุก endpoint และ branch หลักตาม
  flowchart (ค้นหาตามเขต, ตามตำแหน่ง, กรองรัศมี, dropdown เขต, ดูรายละเอียด, id ไม่มีจริง, id ผิด format)
- อยากทดสอบ branch "ดึงข้อมูลไม่สำเร็จ (503)" ให้ปิด MySQL ชั่วคราวแล้วลองยิง
  `curl -i http://localhost:3000/parks` ดู (ยังไม่ได้เขียนเป็น automated test เพราะต้อง mock
  การเชื่อมต่อ MySQL จริง)

### ทดสอบมือด้วย curl
```bash
curl "http://localhost:3000/parks?district=เขตจตุจักร"
curl "http://localhost:3000/parks?lat=13.7563&lng=100.5018"
curl "http://localhost:3000/parks?lat=13.7563&lng=100.5018&radiusKm=3"
curl "http://localhost:3000/parks/districts"
curl "http://localhost:3000/parks/1"
```
