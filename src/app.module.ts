// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParksModule } from './parks/parks.module';
import { Park } from './parks/entities/park.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: parseInt(config.get('DB_PORT', '3306'), 10),
        username: config.get('DB_USER', 'root'),
        password: config.get('DB_PASSWORD', ''),
        database: config.get('DB_NAME', 'bkk_parks'),
        entities: [Park],
        synchronize: true, // สร้างตารางอัตโนมัติจาก entity (เหมาะกับ dev เท่านั้น)
        charset: 'utf8mb4_unicode_ci',
      }),
    }),
    ParksModule,
  ],
})
export class AppModule {}
