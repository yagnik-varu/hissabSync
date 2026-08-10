import { PrismaClient } from '../generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create Users
  console.log('Creating users...');
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      passwordHash: 'dummy_hash', // In a real app this would be bcrypt hashed
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      fullName: 'Bob Johnson',
      email: 'bob@example.com',
      passwordHash: 'dummy_hash',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      fullName: 'Charlie Davis',
      email: 'charlie@example.com',
      passwordHash: 'dummy_hash',
    },
  });

  // 2. Create Room & Settings & Treasury Account
  console.log('Creating room, settings, and treasury account...');
  const room = await prisma.room.upsert({
    where: { roomCode: 'FLAT402' },
    update: {},
    create: {
      name: 'Flat 402',
      roomCode: 'FLAT402',
      description: 'Awesome shared flat',
      createdBy: user1.id,
      settings: {
        create: {
          currencyCode: 'INR',
          allowNegativeTreasury: false,
          requireExpenseApproval: true,
          requireContributionApproval: true,
          autoCreateReimbursement: true,
        },
      },
      treasuryAccount: {
        create: {
          currentBalance: 1500.0, // Starting balance after contributions
        },
      },
    },
  });

  // 3. Create Room Members
  console.log('Assigning room members...');
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user1.id } },
    update: {},
    create: {
      roomId: room.id,
      userId: user1.id,
      role: 'ADMIN',
    },
  });

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user2.id } },
    update: {},
    create: {
      roomId: room.id,
      userId: user2.id,
      role: 'ACCOUNTANT',
    },
  });

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user3.id } },
    update: {},
    create: {
      roomId: room.id,
      userId: user3.id,
      role: 'MEMBER',
    },
  });

  // 4. Create Default Expense Categories
  console.log('Creating default expense categories...');
  const categoryNames = ['Rent', 'Groceries', 'Electricity', 'Maintenance'];
  const categories = [];

  for (const name of categoryNames) {
    const cat = await prisma.expenseCategory.upsert({
      where: { roomId_name: { roomId: room.id, name } },
      update: {},
      create: {
        roomId: room.id,
        name,
        isDefault: true,
      },
    });
    categories.push(cat);
  }

  // 5. Create Contributions & Treasury Transactions
  console.log('Creating contributions & transactions...');
  const contribution1 = await prisma.contribution.create({
    data: {
      roomId: room.id,
      contributorId: user2.id,
      amount: 1000.0,
      note: 'Initial deposit',
      status: 'APPROVED',
      approvedBy: user1.id,
      approvedAt: new Date(),
    },
  });

  await prisma.treasuryTransaction.create({
    data: {
      roomId: room.id,
      transactionType: 'CREDIT',
      referenceType: 'CONTRIBUTION',
      referenceId: contribution1.id,
      amount: 1000.0,
      description: 'Contribution by Bob Johnson',
      createdBy: user1.id,
    },
  });

  const contribution2 = await prisma.contribution.create({
    data: {
      roomId: room.id,
      contributorId: user3.id,
      amount: 500.0,
      note: 'Initial deposit',
      status: 'APPROVED',
      approvedBy: user1.id,
      approvedAt: new Date(),
    },
  });

  await prisma.treasuryTransaction.create({
    data: {
      roomId: room.id,
      transactionType: 'CREDIT',
      referenceType: 'CONTRIBUTION',
      referenceId: contribution2.id,
      amount: 500.0,
      description: 'Contribution by Charlie Davis',
      createdBy: user1.id,
    },
  });

  // 6. Create Expenses
  console.log('Creating expenses...');
  const groceriesCategory = categories.find((c) => c.name === 'Groceries')!;
  
  const expense = await prisma.expense.create({
    data: {
      roomId: room.id,
      submittedBy: user3.id,
      categoryId: groceriesCategory.id,
      amount: 120.5,
      title: 'Weekly Groceries',
      status: 'APPROVED',
      reviewedBy: user1.id,
      reviewedAt: new Date(),
    },
  });

  // 7. Auto-create Reimbursement
  console.log('Creating reimbursement...');
  await prisma.reimbursement.create({
    data: {
      expenseId: expense.id,
      roomId: room.id,
      beneficiaryId: user3.id,
      amount: 120.5,
      status: 'PENDING_PAYMENT',
    },
  });

  console.log('✅ Database seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
