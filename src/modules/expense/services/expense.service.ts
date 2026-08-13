import { Injectable, Logger } from '@nestjs/common';
import { ExpenseRepository } from '../repositories/expense.repository';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private readonly expenseRepository: ExpenseRepository) {}
}
