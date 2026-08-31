import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParksModule } from './parks/parks.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      username: 'root',
      // ⚠️ ใส่ password ของ MySQL root ที่ใช้อยู่ตรงนี้
      password: 'fame1234',
      database: 'bangkok_data',
      charset: 'utf8mb4',
      autoLoadEntities: true,
      synchronize: false, // false เพราะตาราง bangkok_parks มีอยู่แล้ว ไม่ต้องการให้ TypeORM แก้โครงสร้าง
    }),
    ParksModule,
  ],
})
export class AppModule {}
