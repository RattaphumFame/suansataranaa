// src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // อนุญาตให้หน้าเว็บ/แอปค้นหาสวนสาธารณะเรียก API จากคนละ origin ได้
  const config = app.get(ConfigService);
  const port = config.get('API_PORT', 3000);
  await app.listen(port);
  console.log(`🌳 BKK Parks API (NestJS) running at http://localhost:${port}`);
}
bootstrap();
