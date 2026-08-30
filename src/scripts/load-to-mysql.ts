// src/scripts/load-to-mysql.ts
// อ่านไฟล์ CSV ทุกไฟล์ในโฟลเดอร์ data/ (แยกไฟล์ตามเขต เช่น parks_thawi_watthana.csv)
// แล้วรวมทั้งหมดโหลดเข้าตาราง parks ผ่าน TypeORM (ใช้ entity เดียวกับแอป)
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { DataSource } from 'typeorm';
import { Park } from '../parks/entities/park.entity';

dotenv.config();

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bkk_parks',
    entities: [Park],
    synchronize: true,
    charset: 'utf8mb4_unicode_ci',
  });

  await dataSource.initialize();
  console.log('> เชื่อมต่อฐานข้อมูลสำเร็จ');

  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`ไม่พบโฟลเดอร์ data ที่ ${DATA_DIR}`);
  }

  const csvFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();

  if (csvFiles.length === 0) {
    throw new Error(`ไม่พบไฟล์ .csv ในโฟลเดอร์ ${DATA_DIR}`);
  }

  console.log(`> พบไฟล์ CSV ${csvFiles.length} ไฟล์: ${csvFiles.join(', ')}`);

  let allRecords: any[] = [];
  for (const file of csvFiles) {
    const fullPath = path.join(DATA_DIR, file);
    const csvContent = fs.readFileSync(fullPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    console.log(`  - ${file}: ${records.length} แถว`);
    allRecords = allRecords.concat(records);
  }

  const repo = dataSource.getRepository(Park);
  console.log('> ล้างข้อมูลเก่า...');
  await repo.clear();

  console.log(`> กำลังโหลดข้อมูลรวมทั้งหมด ${allRecords.length} สวน...`);
  const parks = allRecords
    .filter((row: any) => row.name && row.district) // ข้ามแถวที่ข้อมูลไม่ครบ
    .map((row: any) =>
      repo.create({
        name: row.name,
        district: row.district,
        description: row.description || null,
        facilities: row.facilities || null,
      }),
    );
  await repo.save(parks);

  console.log(`✔ โหลดข้อมูลสำเร็จทั้งหมด ${parks.length} รายการ จาก ${csvFiles.length} ไฟล์`);
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
