import { PrismaService } from '../../src/database/prisma.service';

export async function clearDatabase(prisma: PrismaService) {
  // Delete in reverse order of foreign key dependencies to prevent constraint violations
  const modelNames = [
    'notification',
    'auditLog',
    'treasuryTransaction',
    'contribution',
    'reimbursement',
    'expense',
    'expenseCategory',
    'treasuryAccount',
    'roomMember',
    'roomSettings',
    'room',
    'refreshToken',
    'user',
  ];

  for (const model of modelNames) {
    try {
      await (prisma as any)[model].deleteMany();
    } catch (e) {
      // Ignore errors silently instead of logging them, to prevent noise in test output
      // if a table is already deleted or another test deleted it concurrently.
    }
  }
}
