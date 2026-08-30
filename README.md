# BKK Parks API (NestJS)

โปรเจกต์ NestJS สำหรับโหลดข้อมูลสวนสาธารณะกรุงเทพฯ เข้า MySQL แล้วเปิดเป็น REST API ให้ค้นหาชื่อ/เขต/ตำแหน่งปัจจุบันได้ — โครงสร้างแบบ Module/Controller/Service ตามสไตล์ Nest พร้อม TypeORM

flow การใช้งานฝั่งผู้ใช้ (ตาม activity diagram):
เปิดหน้าค้นหา → เลือกเขต หรือใช้ตำแหน่งปัจจุบัน → เรียก API `/api/parks` → คัดกรอง/เรียงตามระยะทาง → แสดงรายการ → เลือกดูรายละเอียดสวน (`/api/parks/:id`)

## โครงสร้างโปรเจกต์

```
bkk-parks-nest-2/
├── src/
│   ├── main.ts                        # entrypoint (เปิด CORS)
│   ├── app.module.ts                  # root module + TypeORM config
│   ├── parks/
│   │   ├── entities/park.entity.ts    # TypeORM entity (มี latitude/longitude เผื่ออนาคต)
│   │   ├── parks.module.ts
│   │   ├── parks.controller.ts        # /api/parks, /api/parks/:id
│   │   ├── districts.controller.ts    # /api/districts
│   │   └── parks.service.ts           # query logic + คำนวณระยะทาง (Haversine)
│   └── scripts/
│       └── load-to-mysql.ts           # โหลดทุกไฟล์ CSV ในโฟลเดอร์ data/ เข้า MySQL
├── data/
│   └── parks_<เขต>.csv                # ข้อมูลสวนสาธารณะ แยกไฟล์ตามเขต (รวม 48 สวน / 24 เขต)
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example
```

## ข้อมูล

ข้อมูลสวนสาธารณะทั้ง 48 สวนดึงมาจาก [Greener Bangkok](https://greener.bangkok.go.th/green-space/bangkok-parks/) (สำนักสิ่งแวดล้อม กรุงเทพมหานคร) แยกเป็นไฟล์ CSV ตามเขต 24 ไฟล์ ในโฟลเดอร์ `data/` แต่ละไฟล์มีคอลัมน์ `name, district, description, facilities`

> **หมายเหตุเรื่องพิกัด (lat/lng):** เว็บ Greener Bangkok ไม่มีพิกัดตำแหน่งให้ในรูปแบบข้อความ (แสดงผ่านแผนที่แบบ interactive เท่านั้น) เอนทิตี `Park` จึงมีคอลัมน์ `latitude`/`longitude` เตรียมไว้แต่ยังเป็นค่าว่าง ถ้าต้องการให้ฟีเจอร์ "เรียงตามระยะทางจากตำแหน่งปัจจุบัน" ทำงานได้จริง ต้องเสริมพิกัดเพิ่มทีหลัง เช่น ดึงจาก [Bangkok Open Data](https://data.bangkok.go.th) หรือ geocode ชื่อ/ที่อยู่สวนด้วย Google Maps / OpenStreetMap Nominatim แล้ว `UPDATE` ตาราง `parks` เพิ่ม

## ติดตั้ง

```bash
npm install
cp .env.example .env
```

แก้ `.env` ให้ตรงกับ MySQL ของคุณ

## ใช้งาน

1. โหลดข้อมูลจาก CSV ทุกไฟล์ในโฟลเดอร์ `data/` เข้า MySQL (สร้าง DB/table อัตโนมัติผ่าน TypeORM):
   ```bash
   npm run load
   ```

2. รันเซิร์ฟเวอร์ (dev mode มี hot-reload):
   ```bash
   npm run start:dev
   ```
   หรือ build แล้วรัน production:
   ```bash
   npm run build
   npm run start:prod
   ```

   ค่าเริ่มต้นรันที่ `http://localhost:3000`

## Endpoints

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/parks` | ดึงสวนทั้งหมด |
| GET | `/api/parks?district=เขตจตุจักร` | กรองตามเขต |
| GET | `/api/parks?search=ลุม` | ค้นหาจากชื่อ |
| GET | `/api/parks?lat=13.7563&lng=100.5018` | เรียงตามระยะทางจากตำแหน่งปัจจุบัน (ต้องมีพิกัดในข้อมูลก่อน) |
| GET | `/api/parks/:id` | ดูรายละเอียดสวนเดียว |
| GET | `/api/districts` | รายชื่อเขต + จำนวนสวนในแต่ละเขต |

ตัวอย่าง:
```bash
curl http://localhost:3000/api/parks
curl "http://localhost:3000/api/parks?district=เขตจตุจักร"
curl "http://localhost:3000/api/parks?lat=13.7563&lng=100.5018"
curl http://localhost:3000/api/districts
```

## Stack

- **NestJS** (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`) — โครง Module/Controller/Service
- **TypeORM** + `mysql2` — ORM เชื่อมต่อ MySQL
- **csv-parse** — อ่านไฟล์ CSV (หลายไฟล์จากโฟลเดอร์ `data/`)
- **@nestjs/config** — จัดการ `.env`

## หมายเหตุ

- `synchronize: true` ใน TypeORM ใช้สำหรับ dev เท่านั้น (สร้าง/แก้ตารางอัตโนมัติจาก entity) ถ้าจะขึ้น production จริงควรปิดแล้วใช้ migration แทน
- เปิด CORS ไว้แล้วใน `main.ts` เผื่อฝั่งหน้าเว็บ/แอปค้นหาอยู่คนละ origin
