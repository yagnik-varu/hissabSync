import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ExpenseService } from './src/modules/expense/services/expense.service';
import { RoomService } from './src/modules/room/services/room.service';
import { CategoryService } from './src/modules/category/services/category.service';
import { PrismaService } from './src/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const expenseService = app.get(ExpenseService);
  const roomService = app.get(RoomService);
  const categoryService = app.get(CategoryService);

  // 1. Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: `test-exp-${Date.now()}@example.com`,
      fullName: 'Test Expense User',
      passwordHash: 'dummy',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: `test-admin-${Date.now()}@example.com`,
      fullName: 'Test Admin',
      passwordHash: 'dummy',
    },
  });

  // 2. Create a room (this also sets up the DB and default categories)
  const room = await roomService.createRoom(user.id, {
    name: 'Test Room For Expenses',
    currencyCode: 'INR',
  });

  // Wait for events to process (room.created -> categories seeded)
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Get the first seeded category
  const categories = await prisma.expenseCategory.findMany({ where: { roomId: room.id } });
  const categoryId = categories[0].id;

  // 4. Submit an expense
  const expense = await expenseService.submitExpense(room.id, user.id, {
    categoryId,
    amount: '125.50',
    title: 'Test Approval Event',
  });

  console.log(`\n\n[TEST SCRIPT] Expense ${expense.id} submitted. Approving now...\n\n`);

  // 5. Approve it
  await expenseService.approveExpense(room.id, expense.id, admin.id);

  // Allow event listener to run
  await new Promise(resolve => setTimeout(resolve, 500));

  // 6. Check Room details for pending count (should be 0 now since approved)
  const roomDetails = await roomService.getRoomDetails(room.id, 'ADMIN');
  console.log(`\n\n[TEST SCRIPT] Room pendingExpensesCount: ${roomDetails.pendingExpensesCount}`);

  await app.close();
}

bootstrap().catch(console.error);
