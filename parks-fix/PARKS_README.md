# ระบบค้นหาสวนสาธารณะ (NestJS + MySQL)

ทำตามโฟลว์ชาร์ตที่ให้มา: เลือกเขต/ตำแหน่งปัจจุบัน -> เรียก Open Data API ของ กทม.
-> สำเร็จ/ไม่สำเร็จ -> คัดกรอง/เรียงตามระยะทาง -> จัดรูปแบบผลลัพธ์ -> แสดงรายการ -> ดูรายละเอียด

## ไฟล์ที่เพิ่ม/แก้ไข
- `api/src/parks/parks.module.ts`
- `api/src/parks/parks.controller.ts`
- `api/src/parks/parks.service.ts`
- `api/src/app.module.ts` (เพิ่ม ParksModule)
- `api/src/main.ts` (log endpoint เพิ่ม, โหลด `.env` ตั้งแต่บรรทัดแรก)
- `data/parks_seed.json` — ข้อมูลสวนสาธารณะจริง 20 แห่งในกรุงเทพฯ (ใช้เป็นข้อมูลตั้งต้น/สำรอง)
- `load_parks_to_mysql.js` — สคริปต์โหลดข้อมูลเข้า MySQL ครั้งแรก (หรือรีเฟรช)
- `.env.example` — แม่แบบ environment variables (copy เป็น `.env` แล้วใส่ค่าจริง)
- `.gitignore` — กัน `.env`, `node_modules/`, `dist/` หลุดขึ้น git

## ติดตั้ง
```bash
cd api
npm install
npm install dotenv
```

## ตั้งค่าฐานข้อมูล
```sql
CREATE DATABASE bkk_parks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

ตั้งค่าการเชื่อมต่อผ่านไฟล์ `.env` (ไม่ต้องแก้โค้ดอีกต่อไป):
```bash
cp .env.example .env
```
แล้วแก้ค่าในไฟล์ `.env` ให้ตรงกับเครื่องคุณ เช่น
```
DB_SOCKET_PATH=/tmp/mysql.sock   # หรือคอมเมนต์บรรทัดนี้แล้วใช้ DB_HOST=localhost แทนถ้าต่อผ่าน TCP ปกติ
DB_USER=root
DB_PASSWORD=<รหัสผ่านจริงของคุณ>
DB_NAME=bkk_parks
```
**ห้าม commit ไฟล์ `.env` ขึ้น git เด็ดขาด** (มี `.gitignore` กันไว้ให้แล้ว) — ใช้ `.env.example`
เป็นแม่แบบสำหรับคนอื่นที่มา clone โปรเจกต์แทน

## เชื่อมกับ Open Data API ของ กทม. (ของจริง)
โฟลว์ชาร์ตต้องการให้ระบบเรียก "Open Data API ของ กทม." สดทุกครั้งที่ค้นหา
เว็บ data.bangkok.go.th เป็น CKAN และมี Data API แบบ `datastore_search` ให้ใช้ฟรี:

1. ไปที่ https://data.bangkok.go.th/dataset แล้วค้นหา "สวนสาธารณะ"
2. เปิดชุดข้อมูล "ที่ตั้งสวนสาธารณะของกรุงเทพมหานคร" -> เข้าไปที่ทรัพยากร (resource) ที่ต้องการ
3. ในหน้านั้นจะมีกล่อง "Data API" ซึ่งจะบอก `resource_id` ของทรัพยากรนั้น
4. ตั้งค่า environment variable ก่อนรัน:
   ```bash
   export PARK_RESOURCE_ID=<resource_id ที่ได้>
   ```
5. เปิด `api/src/parks/parks.service.ts` แล้วปรับ mapping field ในเมธอด `syncFromOpenData()`
   ให้ตรงกับชื่อคอลัมน์จริงของชุดข้อมูล (แต่ละชุดตั้งชื่อคอลัมน์ไม่เหมือนกัน เช่น `park_name`,
   `lat`/`latitude` ฯลฯ — ให้เปิดดู field จริงจาก
   `https://data.bangkok.go.th/api/3/action/datastore_search?resource_id=<ID>&limit=1` ก่อน)

**ถ้ายังไม่ได้ตั้งค่า `PARK_RESOURCE_ID`** ระบบจะทำงานได้ปกติโดยใช้ข้อมูลใน MySQL
(bootstrap อัตโนมัติจาก `data/parks_seed.json` ในการเรียกครั้งแรก — ระบบจะไล่หาโฟลเดอร์ `data/`
เองโดยอัตโนมัติ ไม่ว่าจะรันด้วย `start:dev` หรือ build แล้วรันจาก `dist/` ก็ตาม ถ้าหาไม่เจอ
ให้ตั้ง path ตรงๆ ผ่าน `PARK_SEED_FILE=/path/ไปยัง/parks_seed.json` ใน `.env`) — เดโมและทดสอบได้ทันที
โดยไม่ต้องพึ่ง API ภายนอก ส่วนการจัดการ error (สำเร็จ/ไม่สำเร็จ) ยังคงทำงานตามโฟลว์ชาร์ตได้จริง
เมื่อคุณตั้งค่า resource_id แล้วเรียก API ไม่สำเร็จ (เช่น เน็ตล่ม หรือ resource_id ผิด)

## โหลดข้อมูลตั้งต้นเข้า MySQL (ครั้งแรก)
```bash
node load_parks_to_mysql.js
```

## รันเซิร์ฟเวอร์
```bash
cd api
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

### กรณี Open Data API เรียกไม่สำเร็จ (และไม่มีแคชใน MySQL เลย)
`GET /parks` จะตอบกลับด้วย HTTP 503 พร้อมข้อความภาษาไทย เช่น:
```json
{ "statusCode": 503, "message": "ดึงข้อมูลจาก Open Data API ของ กทม. ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
```
ฝั่ง frontend ใช้ status นี้แสดง "แจ้ง error + ปุ่มลองใหม่" ตามโฟลว์ชาร์ตได้เลย

## การทดสอบ
```bash
cd api
npm install --save-dev supertest @types/supertest   # ถ้ายังไม่มี
npm run test          # unit test (test/haversine.spec.ts) — ไม่ต้องมี MySQL
npm run test:e2e      # e2e test (test/parks.e2e-spec.ts) — ต้องมี MySQL รันอยู่ + ตั้งค่า .env แล้ว
```
- `test/haversine.spec.ts` เช็คสูตรคำนวณระยะทางล้วนๆ ไม่พึ่ง DB/network
- `test/parks.e2e-spec.ts` ยิง request จริงผ่าน `ParksModule` ครบทุก endpoint และ branch หลักตาม
  flowchart (ค้นหาตามเขต, ตามตำแหน่ง, กรองรัศมี, dropdown เขต, ดูรายละเอียด, id ไม่มีจริง, id ผิด format)
- อยากทดสอบ branch "ดึงข้อมูลไม่สำเร็จ (503)" ให้ตั้ง `PARK_RESOURCE_ID` ผิดๆ ใน `.env` ชั่วคราว
  แล้วลองยิง `curl -i http://localhost:3000/parks` ดู (ยังไม่ได้เขียนเป็น automated test เพราะ
  ต้อง mock การเรียก Open Data API จริง)

### ทดสอบมือด้วย curl
```bash
curl "http://localhost:3000/parks?district=เขตจตุจักร"
curl "http://localhost:3000/parks?lat=13.7563&lng=100.5018"
curl "http://localhost:3000/parks?lat=13.7563&lng=100.5018&radiusKm=3"
curl "http://localhost:3000/parks/districts"
curl "http://localhost:3000/parks/1"
```
