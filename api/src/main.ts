import "dotenv/config"; // โหลดค่าจากไฟล์ .env ก่อนส่วนอื่น (ต้อง import ก่อน AppModule เสมอ)
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // ให้หน้าเว็บ/แอปฝั่ง frontend เรียกมาได้
  await app.listen(3000);
  console.log("API รันอยู่ที่ http://localhost:3000/parks");
}
bootstrap();
