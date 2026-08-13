import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TreasuryService } from '../services/treasury.service';
import { TreasuryRepository } from '../repositories/treasury.repository';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateAdjustmentDto } from '../dto/create-adjustment.dto';

describe('TreasuryService', () => {
  let treasuryService: TreasuryService;
  let treasuryRepository: jest.Mocked<TreasuryRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockTreasuryRepository = {
      getTreasurySummary: jest.fn(),
      createContribution: jest.fn(),
      getContributionById: jest.fn(),
      updateContributionStatus: jest.fn(),
      approveContributionTx: jest.fn(),
      rejectContributionTx: jest.fn(),
      findTreasuryTransactions: jest.fn(),
      createAdjustmentTx: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreasuryService,
        { provide: TreasuryRepository, useValue: mockTreasuryRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    treasuryService = module.get<TreasuryService>(TreasuryService);
    treasuryRepository = module.get(TreasuryRepository) as jest.Mocked<TreasuryRepository>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('cancelContribution (Self-cancellation Precondition)', () => {
    it('should throw ForbiddenException if user is not the contributor', async () => {
      treasuryRepository.getContributionById.mockResolvedValue({
        id: 'c-1',
        contributorId: 'other-user',
        status: 'PENDING',
      } as any);

      await expect(
        treasuryService.cancelContribution('room-1', 'user-1', 'c-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if status is not PENDING', async () => {
      treasuryRepository.getContributionById.mockResolvedValue({
        id: 'c-1',
        contributorId: 'user-1',
        status: 'APPROVED',
      } as any);

      await expect(
        treasuryService.cancelContribution('room-1', 'user-1', 'c-1')
      ).rejects.toThrow(new BadRequestException('CONTRIBUTION_CANNOT_CANCEL'));
    });

    it('should update status to CANCELLED and emit event if valid', async () => {
      treasuryRepository.getContributionById.mockResolvedValue({
        id: 'c-1',
        contributorId: 'user-1',
        status: 'PENDING',
      } as any);
      
      treasuryRepository.updateContributionStatus.mockResolvedValue({
        id: 'c-1',
        status: 'CANCELLED',
      } as any);

      await treasuryService.cancelContribution('room-1', 'user-1', 'c-1');

      expect(treasuryRepository.updateContributionStatus).toHaveBeenCalledWith('c-1', 'CANCELLED');
      expect(eventEmitter.emit).toHaveBeenCalledWith('contribution.cancelled', expect.any(Object));
    });
  });

  describe('approveContribution (Exception Mapping & Math Delegation)', () => {
    it('should map repository CONTRIBUTION_ALREADY_PROCESSED error to BadRequestException', async () => {
      treasuryRepository.approveContributionTx.mockRejectedValue(new Error('CONTRIBUTION_ALREADY_PROCESSED'));

      await expect(
        treasuryService.approveContribution('room-1', 'c-1', 'admin-1')
      ).rejects.toThrow(new BadRequestException('CONTRIBUTION_ALREADY_PROCESSED'));
    });

    it('should emit event and return contribution when transaction succeeds', async () => {
      treasuryRepository.approveContributionTx.mockResolvedValue({
        id: 'c-1',
        amount: '500.00',
        roomId: 'room-1',
        status: 'APPROVED',
      } as any);

      const result = await treasuryService.approveContribution('room-1', 'c-1', 'admin-1');

      expect(result.id).toBe('c-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('contribution.approved', expect.any(Object));
    });
  });

  describe('createAdjustment', () => {
    it('should delegate CREDIT/DEBIT math to the repository transaction and emit event', async () => {
      const dto: CreateAdjustmentDto = {
        transactionType: 'CREDIT' as any,
        amount: '100.00',
        description: 'Audit correction',
      };

      treasuryRepository.createAdjustmentTx.mockResolvedValue({
        id: 'tx-1',
        transactionType: 'CREDIT',
        amount: '100.00',
      } as any);

      await treasuryService.createAdjustment('room-1', 'admin-1', dto);

      expect(treasuryRepository.createAdjustmentTx).toHaveBeenCalledWith('room-1', 'admin-1', 'CREDIT', '100.00', 'Audit correction');
      expect(eventEmitter.emit).toHaveBeenCalledWith('treasury.adjustment.created', expect.any(Object));
    });
  });
});
