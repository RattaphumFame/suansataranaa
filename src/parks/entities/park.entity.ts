// src/parks/entities/park.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('parks')
export class Park {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  district: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  facilities: string;

  // พิกัด (ถ้ามี) ใช้สำหรับคำนวณระยะทางจากตำแหน่งปัจจุบันของผู้ใช้
  // ข้อมูลจาก greener.bangkok.go.th ไม่มีพิกัดมาให้ ต้องเสริมจาก
  // data.bangkok.go.th (Bangkok Open Data) หรือ geocode เพิ่มทีหลัง
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @CreateDateColumn()
  created_at: Date;
}
