import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('bangkok_parks')
export class Park {
  @PrimaryColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  district: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  rai: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  ngan: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'square_wa',
  })
  squareWa: number;

  @Column({ length: 10, nullable: true, name: 'open_time' })
  openTime: string;

  @Column({ length: 10, nullable: true, name: 'close_time' })
  closeTime: string;

  @Column({ length: 5, nullable: true })
  toilet: string;

  @Column({ length: 5, nullable: true, name: 'sports_field' })
  sportsField: string;

  @Column({ length: 5, nullable: true, name: 'running_track' })
  runningTrack: string;

  @Column({ length: 5, nullable: true, name: 'car_park' })
  carPark: string;

  @Column({ length: 5, nullable: true, name: 'bicycle_path' })
  bicyclePath: string;

  @Column({ length: 255, nullable: true, name: 'other_facility' })
  otherFacility: string;
}
