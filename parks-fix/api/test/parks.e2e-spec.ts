import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { ParksModule } from "../src/parks/parks.module";

/**
 * e2e test: เรียก endpoint จริงผ่าน ParksModule จริง (ต่อ MySQL จริงตาม .env)
 * ก่อนรัน ต้อง:
 *   1. มี MySQL รันอยู่ และตั้งค่าใน .env แล้ว
 *   2. รัน `node load_parks_to_mysql.js` อย่างน้อยหนึ่งครั้ง (หรือปล่อยให้ระบบ bootstrap
 *      จาก data/parks_seed.json อัตโนมัติตอนเรียก endpoint ครั้งแรกก็ได้)
 *
 * รันด้วย: npm run test:e2e
 */
describe("ParksController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ParksModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /parks -> คืนลิสต์สวนสาธารณะ เรียงตามชื่อ ก-ฮ เมื่อไม่ระบุตำแหน่ง", async () => {
    const res = await request(app.getHttpServer()).get("/parks").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // ทุก item ต้องมี field ตามที่ README ระบุ
    const first = res.body[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("coordinates");
    expect(first.distanceKm).toBeNull();
  });

  it("GET /parks?district=... -> กรองตามเขตถูกต้อง", async () => {
    const res = await request(app.getHttpServer())
      .get("/parks")
      .query({ district: "เขตจตุจักร" })
      .expect(200);
    expect(res.body.every((p: any) => p.district === "เขตจตุจักร")).toBe(true);
  });

  it("GET /parks?lat=..&lng=.. -> คืน distanceKm และเรียงจากใกล้ไปไกล", async () => {
    const res = await request(app.getHttpServer())
      .get("/parks")
      .query({ lat: 13.7563, lng: 100.5018 })
      .expect(200);
    const distances = res.body.map((p: any) => p.distanceKm);
    expect(distances.every((d: number) => typeof d === "number")).toBe(true);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });

  it("GET /parks?lat=..&lng=..&radiusKm=.. -> ไม่มี item เกินรัศมีที่กำหนด", async () => {
    const radiusKm = 3;
    const res = await request(app.getHttpServer())
      .get("/parks")
      .query({ lat: 13.7563, lng: 100.5018, radiusKm })
      .expect(200);
    expect(res.body.every((p: any) => p.distanceKm <= radiusKm)).toBe(true);
  });

  it("GET /parks/districts -> คืนรายชื่อเขตพร้อมจำนวน", async () => {
    const res = await request(app.getHttpServer()).get("/parks/districts").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("district");
    expect(res.body[0]).toHaveProperty("count");
  });

  it("GET /parks/:id -> คืนรายละเอียดสวนที่มีจริง", async () => {
    const list = await request(app.getHttpServer()).get("/parks").expect(200);
    const id = list.body[0].id;
    const res = await request(app.getHttpServer()).get(`/parks/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it("GET /parks/:id -> id ที่ไม่มีจริง คืน null", async () => {
    const res = await request(app.getHttpServer()).get("/parks/999999").expect(200);
    expect(res.body).toBeNull();
  });

  it("GET /parks/:id -> id ที่ไม่ใช่ตัวเลข ต้องเป็น 400", async () => {
    await request(app.getHttpServer()).get("/parks/abc").expect(400);
  });
});
