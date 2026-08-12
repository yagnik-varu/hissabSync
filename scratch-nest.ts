import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const accounts = await prisma.treasuryAccount.findMany({
    include: { room: true }
  });
  
  console.log("Found Treasury Accounts:");
  console.dir(accounts, { depth: null });
  
  await app.close();
}
bootstrap();
