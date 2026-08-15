import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/modules/notification/services/notification.service';
import { NotificationRepository } from '../../src/modules/notification/repositories/notification.repository';
import { NotificationListener } from '../../src/modules/notification/events/notification.listener';
import { PrismaService } from '../../src/database/prisma.service';

describe('Notification Module', () => {
  let service: NotificationService;
  let listener: NotificationListener;
  let repository: jest.Mocked<NotificationRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const repositoryMock = {
      createNotification: jest.fn(),
      getUserNotifications: jest.fn(),
      markAsRead: jest.fn(),
    };

    const prismaMock = {
      roomMember: {
        findMany: jest.fn(),
      },
      reimbursement: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        NotificationListener,
        {
          provide: NotificationRepository,
          useValue: repositoryMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    listener = module.get<NotificationListener>(NotificationListener);
    repository = module.get(NotificationRepository) as any;
    prisma = module.get(PrismaService) as any;
  });

  describe('NotificationService', () => {
    it('create should call repository', async () => {
      repository.createNotification.mockResolvedValue({ id: 'notif-1' } as any);
      await service.create('user-1', 'room-1', 'Title', 'Message');
      expect(repository.createNotification).toHaveBeenCalledWith('user-1', 'room-1', 'Title', 'Message');
    });
  });

  describe('NotificationListener', () => {
    it('handleExpenseSubmitted should notify admins and accountants', async () => {
      (prisma.roomMember.findMany as jest.Mock).mockResolvedValue([
        { userId: 'admin-1' },
        { userId: 'acc-1' }
      ] as any);
      
      const envelope: any = {
        roomId: 'room-1',
        payload: { amount: '100' },
      };

      await listener.handleExpenseSubmitted(envelope);
      
      expect(prisma.roomMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ roomId: 'room-1' })
      }));
      expect(repository.createNotification).toHaveBeenCalledTimes(2);
      expect(repository.createNotification).toHaveBeenCalledWith('admin-1', 'room-1', 'New Expense Submitted', expect.any(String));
      expect(repository.createNotification).toHaveBeenCalledWith('acc-1', 'room-1', 'New Expense Submitted', expect.any(String));
    });

    it('handleExpenseApproved should notify submitter', async () => {
      const envelope: any = {
        roomId: 'room-1',
        payload: { amount: '100', submittedBy: 'user-1' },
      };

      await listener.handleExpenseApproved(envelope);
      
      expect(repository.createNotification).toHaveBeenCalledWith(
        'user-1', 
        'room-1', 
        'Expense Approved', 
        expect.stringContaining('100')
      );
    });

    it('handleReimbursementPaid should notify beneficiary', async () => {
      (prisma.reimbursement.findUnique as jest.Mock).mockResolvedValue({ beneficiaryId: 'user-2', amount: '250' } as any);

      const envelope: any = {
        roomId: 'room-1',
        aggregateId: 'reimb-1',
      };

      await listener.handleReimbursementPaid(envelope);

      expect(prisma.reimbursement.findUnique).toHaveBeenCalledWith({ where: { id: 'reimb-1' } });
      expect(repository.createNotification).toHaveBeenCalledWith(
        'user-2', 
        'room-1', 
        'Reimbursement Paid', 
        expect.stringContaining('250')
      );
    });
  });
});
