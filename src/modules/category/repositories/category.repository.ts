import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaultCategories(roomId: string) {
    const defaultCategories = ['Rent', 'Groceries', 'Electricity', 'Maintenance'];
    
    // Use createMany to insert them all in a single query efficiently
    await this.prisma.expenseCategory.createMany({
      data: defaultCategories.map(name => ({
        roomId,
        name,
        isDefault: true,
      })),
      skipDuplicates: true, // Prevents errors if already seeded somehow
    });
  }
}
