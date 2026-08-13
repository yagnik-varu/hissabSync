import { Module } from '@nestjs/common';
import { ExpenseService } from './services/expense.service';
import { ExpenseRepository } from './repositories/expense.repository';

@Module({
  providers: [ExpenseService, ExpenseRepository],
  exports: [ExpenseService],
})
export class ExpenseModule {}
