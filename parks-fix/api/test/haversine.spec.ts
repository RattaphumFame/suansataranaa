/**
 * Unit test เฉพาะสูตรคำนวณระยะทาง (haversine)
 *
 * หมายเหตุ: haversineKm เป็น private method ใน ParksService และ constructor ของ
 * ParksService เรียก mysql.createPool() + ensureTable() (ยิง query ทันที) จึงทดสอบ
 * ParksService ตรงๆ แบบแยกหน่วย (isolated unit test) ไม่ได้ถ้าไม่มี MySQL ต่ออยู่จริง —
 * ทดสอบ flow เต็มๆ ผ่าน test/parks.e2e-spec.ts แทน (ต้องมี DB จริง)
 *
 * ไฟล์นี้ทดสอบแค่ตัว "สูตรคณิตศาสตร์" ล้วนๆ แยกออกมา เพื่อเช็คว่าการคำนวณระยะทาง
 * ถูกต้องโดยไม่ต้องพึ่ง DB/network เลย — ถ้าอยากให้ทดสอบ ParksService ได้ตรงๆ ในอนาคต
 * แนะนำแยก haversineKm ออกเป็นฟังก์ชัน pure function ในไฟล์ต่างหาก (เช่น
 * src/parks/geo.util.ts) แล้ว import มาใช้ทั้งใน service และ test
 */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe("haversineKm", () => {
  it("ระยะทางจากจุดหนึ่งไปยังจุดเดิม ต้องเป็น 0", () => {
    expect(haversineKm(13.7563, 100.5018, 13.7563, 100.5018)).toBeCloseTo(0, 5);
  });

  it("ระยะทางระหว่างสวนลุมพินี กับ สวนเบญจกิติ ต้องใกล้เคียงระยะจริง (~3 กม.)", () => {
    // สวนลุมพินี 13.7307, 100.5418  <->  สวนเบญจกิติ 13.7228, 100.5605
    const km = haversineKm(13.7307, 100.5418, 13.7228, 100.5605);
    expect(km).toBeGreaterThan(1.5);
    expect(km).toBeLessThan(3);
  });

  it("ระยะทางต้องสมมาตร (A->B เท่ากับ B->A)", () => {
    const ab = haversineKm(13.7307, 100.5418, 13.8137, 100.5533);
    const ba = haversineKm(13.8137, 100.5533, 13.7307, 100.5418);
    expect(ab).toBeCloseTo(ba, 6);
  });
});
