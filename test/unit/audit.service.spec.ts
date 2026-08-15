import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../src/modules/audit/services/audit.service';
import { AuditRepository } from '../../src/modules/audit/repositories/audit.repository';
import { AuditListener } from '../../src/modules/audit/events/audit.listener';

describe('Audit Module', () => {
  let service: AuditService;
  let listener: AuditListener;
  let repository: jest.Mocked<AuditRepository>;

  beforeEach(async () => {
    const repositoryMock = {
      createAuditLog: jest.fn(),
      getRoomActivityFeed: jest.fn(),
      getRoomAuditLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        AuditListener,
        {
          provide: AuditRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    listener = module.get<AuditListener>(AuditListener);
    repository = module.get(AuditRepository) as any;
  });

  describe('AuditService', () => {
    it('record should call repository', async () => {
      repository.createAuditLog.mockResolvedValue({ id: 'log-1' } as any);
      await service.record('actor-1', 'room-1', 'EXPENSE', 'exp-1', 'EXPENSE_APPROVED', { amount: 100 });
      expect(repository.createAuditLog).toHaveBeenCalledWith('actor-1', 'room-1', 'EXPENSE', 'exp-1', 'EXPENSE_APPROVED', { amount: 100 });
    });
  });

  describe('AuditListener', () => {
    it('handleExpenseApproved should record audit log', async () => {
      const envelope: any = {
        actorId: 'admin-1',
        roomId: 'room-1',
        aggregateId: 'exp-1',
        payload: { amount: '100', submittedBy: 'user-1' },
      };

      await listener.handleExpenseApproved(envelope);
      
      expect(repository.createAuditLog).toHaveBeenCalledWith(
        'admin-1', 
        'room-1', 
        'EXPENSE', 
        'exp-1', 
        'EXPENSE_APPROVED', 
        expect.objectContaining({ amount: '100', submittedBy: 'user-1' })
      );
    });

    it('handleReimbursementPaid should record audit log', async () => {
      const envelope: any = {
        actorId: 'admin-1',
        roomId: 'room-1',
        aggregateId: 'reimb-1',
        payload: { amount: '100', beneficiaryId: 'user-1', paidBy: 'admin-1' },
      };

      await listener.handleReimbursementPaid(envelope);
      
      expect(repository.createAuditLog).toHaveBeenCalledWith(
        'admin-1', 
        'room-1', 
        'REIMBURSEMENT', 
        'reimb-1', 
        'REIMBURSEMENT_PAID', 
        expect.objectContaining({ amount: '100', beneficiaryId: 'user-1', paidBy: 'admin-1' })
      );
    });

    it('handleContributionApproved should record audit log', async () => {
      const envelope: any = {
        actorId: 'admin-1',
        roomId: 'room-1',
        aggregateId: 'contrib-1',
        payload: { amount: '500', memberId: 'user-1', approvedBy: 'admin-1' },
      };

      await listener.handleContributionApproved(envelope);
      
      expect(repository.createAuditLog).toHaveBeenCalledWith(
        'admin-1', 
        'room-1', 
        'CONTRIBUTION', 
        'contrib-1', 
        'CONTRIBUTION_APPROVED', 
        expect.objectContaining({ amount: '500', contributorId: 'user-1', approvedBy: 'admin-1' })
      );
    });
  });
});
