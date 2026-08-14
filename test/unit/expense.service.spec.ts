import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from '../../src/modules/expense/services/expense.service';
import { ExpenseRepository } from '../../src/modules/expense/repositories/expense.repository';
import { CategoryService } from '../../src/modules/category/services/category.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventNames } from '../../src/events/event-names';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let expenseRepo: jest.Mocked<ExpenseRepository>;
  let categoryService: jest.Mocked<CategoryService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockExpenseRepo = {
      createExpense: jest.fn(),
      findAllExpenses: jest.fn(),
      findExpenseById: jest.fn(),
      updateExpenseStatus: jest.fn(),
      approveExpenseTx: jest.fn(),
      rejectExpenseTx: jest.fn(),
    };

    const mockCategoryService = {
      verifyCategoryExists: jest.fn(),
      getCategories: jest.fn(),
      createCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: ExpenseRepository, useValue: mockExpenseRepo },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
    expenseRepo = module.get(ExpenseRepository);
    categoryService = module.get(CategoryService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('submitExpense', () => {
    it('should submit an expense if category exists in the room', async () => {
      categoryService.verifyCategoryExists.mockResolvedValue(true as any);
      expenseRepo.createExpense.mockResolvedValue({ id: 'exp-1', amount: '100', title: 'Food' } as any);

      await service.submitExpense('room-1', 'user-1', {
        categoryId: 'cat-1',
        amount: '100',
        title: 'Food',
      });

      expect(categoryService.verifyCategoryExists).toHaveBeenCalledWith('room-1', 'cat-1');
      expect(expenseRepo.createExpense).toHaveBeenCalledWith('room-1', 'user-1', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith(EventNames.EXPENSE_SUBMITTED, expect.any(Object));
    });

    it('should throw if category does not exist in the room', async () => {
      categoryService.verifyCategoryExists.mockRejectedValue(new NotFoundException());

      await expect(
        service.submitExpense('room-1', 'user-1', {
          categoryId: 'cat-1',
          amount: '100',
          title: 'Food',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(expenseRepo.createExpense).not.toHaveBeenCalled();
    });
  });

  describe('cancelExpense', () => {
    it('should throw EXPENSE_CANNOT_CANCEL if status is not PENDING', async () => {
      expenseRepo.findExpenseById.mockResolvedValue({
        id: 'exp-1',
        submittedBy: 'user-1',
        status: 'APPROVED',
      } as any);

      await expect(service.cancelExpense('room-1', 'user-1', 'exp-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancelExpense('room-1', 'user-1', 'exp-1')).rejects.toMatchObject({
        response: { code: 'EXPENSE_CANNOT_CANCEL' },
      });
    });

    it('should throw ForbiddenException if user is not the submitter', async () => {
      expenseRepo.findExpenseById.mockResolvedValue({
        id: 'exp-1',
        submittedBy: 'user-2',
        status: 'PENDING',
      } as any);

      await expect(service.cancelExpense('room-1', 'user-1', 'exp-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('approveExpense', () => {
    it('should approve expense and emit event', async () => {
      expenseRepo.approveExpenseTx.mockResolvedValue({
        id: 'exp-1',
        submittedBy: 'user-1',
        amount: '100',
        title: 'Food',
        status: 'APPROVED',
      } as any);

      await service.approveExpense('room-1', 'exp-1', 'admin-1');

      expect(expenseRepo.approveExpenseTx).toHaveBeenCalledWith('room-1', 'exp-1', 'admin-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(EventNames.EXPENSE_APPROVED, expect.objectContaining({
        eventName: EventNames.EXPENSE_APPROVED,
        payload: expect.objectContaining({
          expenseId: 'exp-1',
          approvedBy: 'admin-1',
        }),
      }));
    });
  });

  describe('rejectExpense', () => {
    it('should reject expense with reason and emit event', async () => {
      expenseRepo.rejectExpenseTx.mockResolvedValue({
        id: 'exp-1',
        submittedBy: 'user-1',
        status: 'REJECTED',
      } as any);

      await service.rejectExpense('room-1', 'exp-1', 'admin-1', 'Too expensive');

      expect(expenseRepo.rejectExpenseTx).toHaveBeenCalledWith('room-1', 'exp-1', 'admin-1', 'Too expensive');
      expect(eventEmitter.emit).toHaveBeenCalledWith(EventNames.EXPENSE_REJECTED, expect.objectContaining({
        eventName: EventNames.EXPENSE_REJECTED,
        payload: expect.objectContaining({
          expenseId: 'exp-1',
          rejectedBy: 'admin-1',
          reason: 'Too expensive',
        }),
      }));
    });
  });
});
