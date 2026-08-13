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

  async findAll(roomId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { roomId },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async create(roomId: string, name: string) {
    return this.prisma.expenseCategory.create({
      data: {
        roomId,
        name,
        isDefault: false,
      },
    });
  }

  async delete(roomId: string, categoryId: string) {
    return this.prisma.expenseCategory.delete({
      where: {
        id: categoryId,
        roomId, // Ensure it belongs to this room
      },
    });
  }

  async findById(roomId: string, categoryId: string) {
    return this.prisma.expenseCategory.findUnique({
      where: {
        id: categoryId,
        roomId, // strict scoping to room
      },
    });
  }
}
