import { Test, TestingModule } from '@nestjs/testing';
import { ReimbursementService } from '../../src/modules/reimbursement/services/reimbursement.service';
import { ReimbursementRepository } from '../../src/modules/reimbursement/repositories/reimbursement.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client/client';
import { EventNames } from '../../src/events/event-names';
import { DomainEventEnvelope } from '../../src/events/payloads';

describe('ReimbursementService', () => {
  let service: ReimbursementService;
  let repository: jest.Mocked<ReimbursementRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const repositoryMock = {
      createPendingReimbursement: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      payReimbursementTx: jest.fn(),
    };

    const eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReimbursementService,
        {
          provide: ReimbursementRepository,
          useValue: repositoryMock,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
      ],
    }).compile();

    service = module.get<ReimbursementService>(ReimbursementService);
    repository = module.get(ReimbursementRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleExpenseApproved (auto-create listener)', () => {
    it('should create a pending reimbursement and emit REIMBURSEMENT_CREATED event', async () => {
      const mockReimbursement = { id: 'reimb-123', amount: '500' };
      repository.createPendingReimbursement.mockResolvedValue(mockReimbursement as any);

      const eventPayload: any = {
        eventId: 'evt-1',
        payload: {
          expenseId: 'exp-1',
          roomId: 'room-1',
          submittedBy: 'user-1',
          amount: '500',
        },
        metadata: { correlationId: 'corr-1' },
      };

      await service.handleExpenseApproved(eventPayload);

      expect(repository.createPendingReimbursement).toHaveBeenCalledWith({
        expenseId: 'exp-1',
        roomId: 'room-1',
        beneficiaryId: 'user-1',
        amount: '500',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventNames.REIMBURSEMENT_CREATED,
        expect.objectContaining({
          aggregateId: 'reimb-123',
          eventName: EventNames.REIMBURSEMENT_CREATED,
        })
      );
    });
  });

  describe('payReimbursement', () => {
    it('should successfully pay out in Flexible mode (or when balance is sufficient)', async () => {
      repository.payReimbursementTx.mockResolvedValue({
        reimbursement: { id: 'reimb-1', status: 'PAID', paidAt: new Date(), amount: '500' } as any,
        treasuryNewBalance: new Prisma.Decimal(-100), // Flexible mode allows negative
      });

      const result = await service.payReimbursement('room-1', 'reimb-1', 'admin-1');

      expect(repository.payReimbursementTx).toHaveBeenCalledWith('room-1', 'reimb-1', 'admin-1');
      expect(result.status).toBe('PAID');
      expect(result.treasuryNewBalance).toBe('-100.00');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventNames.REIMBURSEMENT_PAID,
        expect.objectContaining({
          aggregateId: 'reimb-1',
          payload: expect.objectContaining({
            reimbursementId: 'reimb-1',
            paidBy: 'admin-1',
          }),
        })
      );
    });

    it('should throw ConflictException if REIMBURSEMENT_ALREADY_PAID', async () => {
      repository.payReimbursementTx.mockRejectedValue(new Error('REIMBURSEMENT_ALREADY_PAID'));

      await expect(service.payReimbursement('room-1', 'reimb-1', 'admin-1'))
        .rejects
        .toThrow(ConflictException);
      
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for TREASURY_INSUFFICIENT_BALANCE in Strict mode', async () => {
      repository.payReimbursementTx.mockRejectedValue(new Error('TREASURY_INSUFFICIENT_BALANCE'));

      await expect(service.payReimbursement('room-1', 'reimb-1', 'admin-1'))
        .rejects
        .toThrow(BadRequestException);
      
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
