import { Module } from '@nestjs/common';
import { ExpenseService } from './services/expense.service';
import { ExpenseRepository } from './repositories/expense.repository';

import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { CategoryModule } from '../category/category.module';
import { ExpenseController } from './controllers/expense.controller';

@Module({
  imports: [AuthModule, RoomModule, CategoryModule],
  controllers: [ExpenseController],
  providers: [ExpenseService, ExpenseRepository],
  exports: [ExpenseService],
})
export class ExpenseModule {}
