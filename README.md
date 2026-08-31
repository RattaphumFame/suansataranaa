# ระบบค้นหาสวนสาธารณะ (NestJS)

ทำตามโฟลว์ชาร์ตที่ให้มา: เลือกเขต/ตำแหน่งปัจจุบัน -> ดึงข้อมูล -> สำเร็จ/ไม่สำเร็จ ->
คัดกรอง/เรียงตามระยะทาง -> จัดรูปแบบผลลัพธ์ -> แสดงรายการ -> ดูรายละเอียด

## แหล่งข้อมูล (สำคัญ - อ่านก่อนใช้งาน)

**ระบบนี้ไม่มีฐานข้อมูลแล้ว** ทุก endpoint ดึงข้อมูลสวนสาธารณะ **สดจากเว็บ
`https://greener.bangkok.go.th/park/`** ของสำนักสิ่งแวดล้อม กทม. โดยตรงทุกครั้งที่มีการเรียก
(scrape หน้า HTML) แล้วเติมพิกัด lat/lng ด้วยการ **geocode ที่อยู่/ชื่อสวนผ่าน OpenStreetMap
Nominatim** (เพราะเว็บต้นทางไม่มี lat/lng ให้โดยตรง มีแต่ลิงก์ Google Maps แบบ short-link)

### ข้อจำกัดที่ควรรู้ก่อนใช้งานจริง
- **ความเร็ว**: การ geocode ต้องหน่วง ~1 วินาที/สวน ตามนโยบายของ Nominatim ถ้า cache หมด
  อายุพอดี การค้นหาแบบมี `lat`/`lng` กับสวนหลายสิบแห่งอาจใช้เวลาหลายสิบวินาที
- **cache ชั่วคราว**: มีการ cache ผลไว้ในหน่วยความจำ (ไม่ใช่ฐานข้อมูล) ตาม `CACHE_TTL_SECONDS`
  ใน `.env` (ค่าเริ่มต้น 15 นาที) เพื่อไม่ให้ยิงเว็บต้นทาง/Nominatim ถี่เกินไปจนโดนบล็อก
  cache นี้หายไปทุกครั้งที่ restart process
- **ความแม่นยำของพิกัด**: พิกัดจาก Nominatim เป็นการเดาจากชื่อ/ที่อยู่ อาจคลาดเคลื่อนจาก
  ตำแหน่งจริงได้บ้าง โดยเฉพาะสวนขนาดใหญ่
- **id ของสวน**: เป็นเลขลำดับตามที่ scrape เจอจากหน้าเว็บ (ไม่ใช่ id ถาวรจากต้นทาง) อาจ
  เปลี่ยนได้ถ้าเว็บต้นทางเพิ่ม/ลบ/สลับลำดับสวน ระหว่างรอบ cache ใหม่
- **ความเปราะบางของการ scrape**: โค้ดแกะข้อมูลจากโครงสร้าง HTML ของเว็บ ณ ตอนที่เขียน ถ้า
  ทาง กทม. เปลี่ยนดีไซน์เว็บ อาจต้องแก้ selector ใน `parks.service.ts` ใหม่
- **หน้าลิสต์ vs หน้ารายละเอียด**: `GET /parks` (ลิสต์/ค้นหา) จะไม่ดึงที่อยู่เต็ม/พื้นที่ไร่/
  สิ่งอำนวยความสะดวกครบของทุกสวน เพื่อความเร็ว ต้องเรียก `GET /parks/:id` ถึงจะได้ข้อมูลเต็ม

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
│   │       └── parks.service.ts   <- scrape เว็บ + geocode สด ไม่มี fallback DB
│   └── test/
│       ├── haversine.spec.ts
│       └── parks.e2e-spec.ts      <- ต้องต่ออินเทอร์เน็ตจริงตอนรัน
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

## ตั้งค่า (ไม่บังคับ)
```bash
cp .env.example .env
```
ทุกค่ามี default อยู่แล้ว ปกติไม่ต้องแก้อะไรก็รันได้เลย แต่แนะนำให้ตั้ง
`NOMINATIM_USER_AGENT` เป็นอีเมล/เว็บของคุณเอง ตามนโยบายการใช้งานของ Nominatim
(https://operations.osmfoundation.org/policies/nominatim/)

## รันเซิร์ฟเวอร์
```bash
npm run start:dev
```
คำขอแรกที่เข้ามาจะดึงรายชื่อสวนจากเว็บต้นทาง จึงอาจช้ากว่าคำขอถัดไปที่ยังอยู่ในช่วง cache

## Endpoints
- `GET /parks?district=เขตจตุจักร` — ค้นหาตามเขต
- `GET /parks?lat=13.7563&lng=100.5018&radiusKm=5` — ค้นหาจากตำแหน่งปัจจุบัน เรียงใกล้ไปไกล
  (ใส่ `radiusKm` ถ้าต้องการกรองเฉพาะในรัศมีที่กำหนด)
- `GET /parks/districts` — รายชื่อเขตทั้งหมด พร้อมจำนวนสวน (ใช้ทำ dropdown "เลือกเขต")
- `GET /parks/:id` — รายละเอียดสวนสาธารณะ 1 แห่ง (ดึงหน้า detail สดของสวนนั้นเพิ่ม)

### ตัวอย่าง response ของ `GET /parks?lat=13.7563&lng=100.5018`
```json
[
  {
    "id": 5,
    "name": "สวนเบญจกิติ",
    "district": "เขตคลองเตย",
    "address": null,
    "coordinates": { "lat": 13.7228, "lng": 100.5605 },
    "areaRai": null,
    "facilities": [],
    "imageUrl": "https://greener.bangkok.go.th/wp-content/uploads/.../benjakitti.jpg",
    "detailUrl": "https://greener.bangkok.go.th/park/benjakitti-park/",
    "distanceKm": 2.31
  }
]
```
(`address`/`areaRai`/`facilities` จะว่างในหน้าลิสต์ เพื่อความเร็ว — เรียก `GET /parks/5` เพื่อ
ดูข้อมูลเต็ม)

### กรณีดึงข้อมูลจากเว็บต้นทางไม่สำเร็จ
`GET /parks` (และ endpoint อื่นๆ) จะตอบกลับด้วย HTTP 503 พร้อมข้อความภาษาไทย เช่น:
```json
{ "statusCode": 503, "message": "ดึงข้อมูลจากเว็บไซต์ต้นทาง (greener.bangkok.go.th) ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
```
ฝั่ง frontend ใช้ status นี้แสดง "แจ้ง error + ปุ่มลองใหม่" ตามโฟลว์ชาร์ตได้เลย

## การทดสอบ
```bash
npm test          # unit test (api/test/haversine.spec.ts) — ไม่ต้องต่อเน็ต
npm run test:e2e  # e2e test (api/test/parks.e2e-spec.ts) — ต้องต่ออินเทอร์เน็ตจริง อาจใช้เวลานาน
```
- `haversine.spec.ts` เช็คสูตรคำนวณระยะทางล้วนๆ ไม่พึ่ง network
- `parks.e2e-spec.ts` ยิง request จริงผ่าน `ParksModule` ไปหาเว็บ greener.bangkok.go.th และ
  Nominatim จริง เช็ครูปร่าง response ตามสัญญา (ไม่เช็คค่าตายตัว เพราะข้อมูลจากเว็บเปลี่ยนได้)

### ทดสอบมือด้วย curl
```bash
curl "http://localhost:3000/parks?district=เขตจตุจักร"
curl "http://localhost:3000/parks?lat=13.7563&lng=100.5018"
curl "http://localhost:3000/parks?lat=13.7563&lng=100.5018&radiusKm=3"
curl "http://localhost:3000/parks/districts"
curl "http://localhost:3000/parks/1"
```
