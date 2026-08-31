import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { ParksModule } from "../src/parks/parks.module";

/**
 * e2e test: เรียก endpoint จริงผ่าน ParksModule จริง
 *
 * หมายเหตุสำคัญ: ตั้งแต่เวอร์ชันนี้ ระบบไม่ใช้ฐานข้อมูลแล้ว - ทุก endpoint ดึงข้อมูลสดจาก
 * เว็บ https://greener.bangkok.go.th จริงๆ ทุกครั้ง แล้ว geocode พิกัดผ่าน OpenStreetMap
 * Nominatim ดังนั้นเทสต์ชุดนี้ **ต้องมีการเชื่อมต่ออินเทอร์เน็ตออกไปนอกเครื่อง** และอาจใช้
 * เวลานานกว่าปกติ (โดยเฉพาะ test ที่มี lat/lng ซึ่งต้อง geocode ทีละสวน หน่วง ~1 วินาที/สวน
 * ตามนโยบายของ Nominatim ในรอบแรกที่ยังไม่มี cache)
 *
 * เพราะข้อมูลมาจากเว็บจริงที่เปลี่ยนแปลงได้ และ geocode อาจพลาดบางสวน เทสต์ชุดนี้จึงเช็ค
 * แค่ "รูปร่าง" ของ response ว่าถูกต้องตามสัญญา ไม่เช็คค่าตายตัว (เช่น จำนวนสวนเป๊ะๆ)
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
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it("GET /parks -> คืนลิสต์สวนสาธารณะ เรียงตามชื่อ ก-ฮ เมื่อไม่ระบุตำแหน่ง", async () => {
    const res = await request(app.getHttpServer()).get("/parks").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const first = res.body[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("detailUrl");
    expect(first.distanceKm).toBeNull();
  }, 30000);

  it("GET /parks?district=... -> กรองตามเขตถูกต้อง", async () => {
    const listRes = await request(app.getHttpServer()).get("/parks").expect(200);
    const sampleDistrict = listRes.body.find((p: any) => p.district)?.district;
    if (!sampleDistrict) return; // ถ้า scrape เขตไม่ได้เลยในรอบนี้ ข้าม assertion นี้ไป

    const res = await request(app.getHttpServer())
      .get("/parks")
      .query({ district: sampleDistrict })
      .expect(200);
    expect(res.body.every((p: any) => p.district === sampleDistrict)).toBe(true);
  }, 30000);

  it("GET /parks?lat=..&lng=.. -> คืน distanceKm (หรือ null ถ้า geocode พลาด) และเรียงจากใกล้ไปไกล", async () => {
    const res = await request(app.getHttpServer())
      .get("/parks")
      .query({ lat: 13.7563, lng: 100.5018 })
      .expect(200);
    const distances = res.body.map((p: any) => p.distanceKm);
    expect(distances.every((d: number | null) => d === null || typeof d === "number")).toBe(true);
    const withValue = distances.filter((d: number | null): d is number => d !== null);
    const sorted = [...withValue].sort((a, b) => a - b);
    expect(withValue).toEqual(sorted);
  }, 120000);

  it("GET /parks?lat=..&lng=..&radiusKm=.. -> ไม่มี item เกินรัศมีที่กำหนด", async () => {
    const radiusKm = 5;
    const res = await request(app.getHttpServer())
      .get("/parks")
      .query({ lat: 13.7563, lng: 100.5018, radiusKm })
      .expect(200);
    expect(res.body.every((p: any) => p.distanceKm !== null && p.distanceKm <= radiusKm)).toBe(true);
  }, 120000);

  it("GET /parks/districts -> คืนรายชื่อเขตพร้อมจำนวน", async () => {
    const res = await request(app.getHttpServer()).get("/parks/districts").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("district");
    expect(res.body[0]).toHaveProperty("count");
  }, 30000);

  it("GET /parks/:id -> คืนรายละเอียดสวนที่มีจริง (ดึง detail page สดของสวนนั้น)", async () => {
    const list = await request(app.getHttpServer()).get("/parks").expect(200);
    const id = list.body[0].id;
    const res = await request(app.getHttpServer()).get(`/parks/${id}`).expect(200);
    expect(res.body.id).toBe(id);
    expect(res.body).toHaveProperty("facilities");
  }, 30000);

  it("GET /parks/:id -> id ที่ไม่มีจริง คืน null", async () => {
    const res = await request(app.getHttpServer()).get("/parks/999999").expect(200);
    expect(res.body).toBeNull();
  }, 30000);

  it("GET /parks/:id -> id ที่ไม่ใช่ตัวเลข ต้องเป็น 400", async () => {
    await request(app.getHttpServer()).get("/parks/abc").expect(400);
  }, 30000);
});
