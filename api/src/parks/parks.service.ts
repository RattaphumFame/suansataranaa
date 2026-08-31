import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import * as cheerio from "cheerio";

interface SourcePark {
  id: number;
  name: string;
  slug: string;
  district: string | null;
  detailUrl: string;
  imageUrl: string | null;
}

interface DetailInfo {
  address: string | null;
  areaRai: number | null;
  facilities: string[];
  imageUrl: string | null;
}

interface GeoPoint {
  lat: number;
  lng: number;
}

const SOURCE_BASE = process.env.SOURCE_BASE_URL || "https://greener.bangkok.go.th";
const LIST_PATH = "/park";
const MAX_LIST_PAGES = Number(process.env.SOURCE_MAX_PAGES || 8);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_SECONDS || 900) * 1000;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ||
  "bkk-parks-api/1.0 (ตั้งค่า NOMINATIM_USER_AGENT ใน .env ให้เป็นอีเมล/URL ของคุณ ตามนโยบายของ Nominatim)";
// เคารพ usage policy ของ Nominatim (จำกัดสูงสุด ~1 request/วินาที ต่อผู้ให้บริการ)
const GEOCODE_MIN_INTERVAL_MS = 1100;

/**
 * ดึงข้อมูลสวนสาธารณะ "สด" จากเว็บ https://greener.bangkok.go.th ทุกครั้งที่มีการค้นหา
 * (ไม่มีการอ่าน/เขียนฐานข้อมูลใดๆ) แล้วเติมพิกัด lat/lng ด้วยการ geocode ที่อยู่ผ่าน
 * OpenStreetMap Nominatim เนื่องจากเว็บต้นทางไม่มี lat/lng ให้โดยตรง (มีแต่ลิงก์ Google Maps
 * แบบ short-link ที่แกะพิกัดจากหน้าเว็บตรงๆ ไม่ได้)
 *
 * หมายเหตุสำคัญเกี่ยวกับ cache:
 * เพื่อไม่ให้ยิง request ไปที่เว็บต้นทาง/Nominatim ถี่เกินไปจนถูกบล็อก (และเพื่อความเร็วที่พอ
 * ใช้งานได้จริง) มีการ cache ผลไว้ชั่วคราวในหน่วยความจำ (in-memory) ตาม CACHE_TTL_SECONDS
 * ใน .env (ค่าเริ่มต้น 900 วินาที = 15 นาที) นี่ไม่ใช่ฐานข้อมูล - แค่ cache ชั่วคราวที่หายไป
 * เมื่อ process รีสตาร์ท ถ้าต้องการดึงสดจริงๆ ทุก request แบบไม่ cache เลย ตั้ง
 * CACHE_TTL_SECONDS=0 ได้ แต่จะทำให้ทุก request ช้ามาก (ต้องรอ geocode ทีละสวนแบบหน่วง
 * ~1 วินาที/สวน ตามนโยบายของ Nominatim) และมีความเสี่ยงที่ IP จะโดนจำกัดการใช้งาน
 *
 * หมายเหตุเรื่องความแม่นยำ/ความเสถียร:
 * - selector ที่ใช้แกะ HTML อิงจากโครงสร้างเว็บ ณ ตอนที่เขียนโค้ดนี้ ถ้าทาง กทม. เปลี่ยน
 *   ดีไซน์เว็บในอนาคต โค้ดส่วนแกะข้อมูล (scrapeAllParks / scrapeDetail) อาจต้องปรับใหม่
 * - id ของแต่ละสวนคือลำดับที่แกะเจอจากหน้า archive (ไม่ใช่ id ถาวรจากต้นทาง) ถ้าเว็บต้นทาง
 *   เพิ่ม/ลบ/สลับลำดับสวน id อาจเปลี่ยนได้ระหว่างรอบ cache ใหม่ๆ
 * - พิกัดที่ได้จาก Nominatim เป็นการเดาจากชื่อ/ที่อยู่ อาจคลาดเคลื่อนจากตำแหน่งจริงได้บ้าง
 *   (โดยเฉพาะสวนขนาดใหญ่ที่ Nominatim อาจตอบเป็นจุดกึ่งกลางเขต ไม่ใช่ประตูสวน)
 */
@Injectable()
export class ParksService {
  private listCache: { data: SourcePark[]; expiresAt: number } | null = null;
  private listFetchInFlight: Promise<SourcePark[]> | null = null;

  private geocodeCache = new Map<string, { point: GeoPoint | null; expiresAt: number }>();
  private lastGeocodeAt = 0;

  // ---------- ชั้นดึง HTML ดิบจากเว็บต้นทาง ----------
  private async fetchHtml(url: string): Promise<string> {
    let res: any;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; bkk-parks-api/1.0; +https://bangkok.go.th)" },
      });
    } catch {
      throw new ServiceUnavailableException(
        "ดึงข้อมูลจากเว็บไซต์ต้นทาง (greener.bangkok.go.th) ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `ดึงข้อมูลจากเว็บไซต์ต้นทางไม่สำเร็จ (HTTP ${res.status}) กรุณาลองใหม่อีกครั้ง`
      );
    }
    return res.text();
  }

  // ---------- ชั้น cache รายชื่อสวนทั้งหมด (สด + cache สั้นๆ กันยิงถี่เกินไป) ----------
  private async getSourceParks(): Promise<SourcePark[]> {
    const now = Date.now();
    if (this.listCache && this.listCache.expiresAt > now) {
      return this.listCache.data;
    }
    if (this.listFetchInFlight) {
      return this.listFetchInFlight;
    }
    this.listFetchInFlight = this.scrapeAllParks()
      .then((data) => {
        this.listCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return data;
      })
      .finally(() => {
        this.listFetchInFlight = null;
      });
    return this.listFetchInFlight;
  }

  /**
   * แกะรายชื่อสวนทั้งหมดจากหน้า archive https://greener.bangkok.go.th/park/
   * (แบ่งหน้าแบบ WordPress ปกติ /park/page/2/ ฯลฯ ไล่ไปจนไม่มีสวนใหม่เพิ่ม หรือครบ
   * MAX_LIST_PAGES หน้า กันวนลูปไม่รู้จบถ้าเว็บเปลี่ยนโครงสร้าง)
   */
  private async scrapeAllParks(): Promise<SourcePark[]> {
    const parks: Omit<SourcePark, "id">[] = [];
    const seenSlugs = new Set<string>();

    for (let page = 1; page <= MAX_LIST_PAGES; page++) {
      const url = page === 1 ? `${SOURCE_BASE}${LIST_PATH}/` : `${SOURCE_BASE}${LIST_PATH}/page/${page}/`;
      let html: string;
      try {
        html = await this.fetchHtml(url);
      } catch (err) {
        if (page === 1) throw err; // หน้าแรกดึงไม่ได้เลย = error จริง
        break; // หน้าถัดไปดึงไม่ได้ (เช่น 404) = ถือว่าหมดหน้าแล้ว
      }

      const $ = cheerio.load(html);
      const before = seenSlugs.size;

      $('a[href*="/park/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/\/park\/([a-z0-9-]+)\/?$/i);
        if (!match) return;
        const slug = match[1];
        if (!slug || slug === "page" || seenSlugs.has(slug)) return;

        // ชื่อสวน: ลองเอาจาก alt รูปก่อน แล้วค่อย fallback ไปหาหัวข้อ/ข้อความใกล้ๆ ลิงก์
        let name =
          $(el).find("img").attr("alt")?.trim() ||
          $(el).find("h1,h2,h3,h4").first().text().trim() ||
          $(el).text().trim();
        name = name.split("\n")[0].trim();
        if (!name || name.length > 120) return;

        const imageUrl = $(el).find("img").attr("src") || $(el).attr("href") ? $(el).find("img").attr("src") || null : null;

        // มองหาย่อหน้าคำอธิบายรอบๆ ลิงก์ เพื่อหาชื่อเขต (เช่น "...เขตคลองเตย")
        const container = $(el).closest("article, li, div").parent();
        const descText = container.text();
        const districtMatch = descText.match(/เขต[^\s,()]{2,20}/);

        seenSlugs.add(slug);
        parks.push({
          name,
          slug,
          district: districtMatch ? districtMatch[0] : null,
          detailUrl: `${SOURCE_BASE}${LIST_PATH}/${slug}/`,
          imageUrl,
        });
      });

      if (seenSlugs.size === before) break; // หน้านี้ไม่มีสวนใหม่เพิ่ม = ถึงหน้าสุดท้ายแล้ว
    }

    if (parks.length === 0) {
      throw new ServiceUnavailableException(
        "ดึงข้อมูลจากเว็บไซต์ต้นทางไม่สำเร็จ (ไม่พบรายการสวนสาธารณะในหน้าเว็บ) กรุณาลองใหม่อีกครั้ง"
      );
    }

    return parks.map((p, i) => ({ ...p, id: i + 1 }));
  }

  /** ดึงรายละเอียดเต็มของสวน 1 แห่ง (ใช้ตอนเรียก GET /parks/:id เท่านั้น ไม่ใช้ตอนค้นหาลิสต์) */
  private async scrapeDetail(detailUrl: string): Promise<DetailInfo> {
    const html = await this.fetchHtml(detailUrl);
    const $ = cheerio.load(html);
    const fullText = $("body").text().replace(/\s+/g, " ");

    const addressMatch = fullText.match(/ที่ตั้ง\s*([^]{5,150}?)(?:เวลาเปิด|ค่าบริการ|ติดต่อ|$)/);
    const areaMatch = fullText.match(/(\d+(?:\.\d+)?)\s*ไร่/);

    const facilities: string[] = [];
    $("li").each((_, li) => {
      const t = $(li).text().trim();
      if (t && t.length > 1 && t.length < 60 && !facilities.includes(t)) {
        facilities.push(t);
      }
    });

    const imageUrl = $('meta[property="og:image"]').attr("content") || null;

    return {
      address: addressMatch ? addressMatch[1].trim() : null,
      areaRai: areaMatch ? Number(areaMatch[1]) : null,
      facilities: facilities.slice(0, 25),
      imageUrl,
    };
  }

  // ---------- Geocode ชื่อ/ที่อยู่ ด้วย OpenStreetMap Nominatim (สด, เคารพ rate limit + cache สั้นๆ) ----------
  private async geocode(query: string): Promise<GeoPoint | null> {
    const key = query.trim();
    if (!key) return null;

    const now = Date.now();
    const cached = this.geocodeCache.get(key);
    if (cached && cached.expiresAt > now) return cached.point;

    const wait = GEOCODE_MIN_INTERVAL_MS - (now - this.lastGeocodeAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastGeocodeAt = Date.now();

    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=th&q=${encodeURIComponent(key)}`;
    let point: GeoPoint | null = null;
    try {
      const res: any = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
      if (res.ok) {
        const results = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (results.length > 0) {
          point = { lat: Number(results[0].lat), lng: Number(results[0].lon) };
        }
      }
    } catch {
      point = null; // geocode สวนนี้ไม่สำเร็จ -> ไม่ทำให้ทั้ง request ล่ม แค่สวนนี้ไม่มีระยะทาง
    }

    this.geocodeCache.set(key, { point, expiresAt: now + CACHE_TTL_MS });
    return point;
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * GET /parks?district=..&lat=..&lng=..&radiusKm=..
   * ดึงลิสต์สวนจากเว็บต้นทางสด ๆ แล้วกรองเขต/ระยะทาง + geocode หา distanceKm ถ้ามี lat/lng
   * (หน้าลิสต์นี้จะยังไม่ดึงที่อยู่เต็ม/พื้นที่ไร่/สิ่งอำนวยความสะดวกครบ เพื่อความเร็ว - ดูของ
   * เต็มได้ที่ GET /parks/:id)
   */
  async findAll(district?: string, lat?: number, lng?: number, radiusKm?: number) {
    let parks = await this.getSourceParks();

    if (district) {
      parks = parks.filter((p) => p.district === district);
    }

    const hasLocation = typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);

    const formatted: any[] = [];
    for (const p of parks) {
      let distanceKm: number | null = null;
      let coordinates: { lat: number; lng: number } | null = null;
      if (hasLocation) {
        const point = await this.geocode(`${p.name} ${p.district || ""} กรุงเทพมหานคร`.trim());
        if (point) {
          coordinates = point;
          distanceKm = Math.round(this.haversineKm(lat!, lng!, point.lat, point.lng) * 100) / 100;
        }
      }
      formatted.push({
        id: p.id,
        name: p.name,
        district: p.district,
        address: null,
        coordinates,
        areaRai: null,
        facilities: [],
        imageUrl: p.imageUrl,
        detailUrl: p.detailUrl,
        distanceKm,
      });
    }

    let result = formatted;
    if (hasLocation && radiusKm) {
      result = result.filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm);
    }
    if (hasLocation) {
      result.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name, "th"));
    }
    return result;
  }

  /** GET /parks/districts -> รายชื่อเขตที่มีสวนสาธารณะ ใช้ทำ dropdown "เลือกเขต" */
  async listDistricts() {
    const parks = await this.getSourceParks();
    const counts = new Map<string, number>();
    for (const p of parks) {
      const d = p.district || "ไม่ระบุเขต";
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => a.district.localeCompare(b.district, "th"));
  }

  /** GET /parks/:id -> ดึงรายละเอียดเต็มของสวน 1 แห่ง (fetch หน้า detail จริงของสวนนั้น) */
  async findOne(id: number) {
    const parks = await this.getSourceParks();
    const park = parks.find((p) => p.id === id);
    if (!park) return null;

    const detail = await this.scrapeDetail(park.detailUrl);
    const geoQuery = detail.address || `${park.name} ${park.district || ""} กรุงเทพมหานคร`;
    const point = await this.geocode(geoQuery);

    return {
      id: park.id,
      name: park.name,
      district: park.district,
      address: detail.address,
      coordinates: point,
      areaRai: detail.areaRai,
      facilities: detail.facilities,
      imageUrl: detail.imageUrl || park.imageUrl,
      detailUrl: park.detailUrl,
      distanceKm: null,
    };
  }
}
