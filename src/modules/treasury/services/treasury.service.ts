import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { EventNames } from '../../../events/event-names';
import { TreasuryRepository } from '../repositories/treasury.repository';
import type { RoomCreatedPayload } from '../../../events/payloads/room-created.payload';
import type { DomainEventEnvelope } from '../../../events/payloads/domain-event.envelope';
import type { TreasuryAccountCreatedPayload } from '../../../events/payloads/treasury-account-created.payload';
import type { ContributionSubmittedPayload } from '../../../events/payloads/contribution-submitted.payload';
import type { ContributionCancelledPayload } from '../../../events/payloads/contribution-cancelled.payload';
import { SubmitContributionDto } from '../dto/submit-contribution.dto';
import { ListContributionsDto } from '../dto/list-contributions.dto';

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    private readonly treasuryRepository: TreasuryRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Listens for the `room.created` event and provisions a 1:1 Treasury Account.
   * This is entirely decoupled from RoomModule.
   */
  @OnEvent(EventNames.ROOM_CREATED)
  async handleRoomCreatedEvent(event: DomainEventEnvelope<RoomCreatedPayload>) {
    this.logger.log(`Handling ${EventNames.ROOM_CREATED} event for room ${event.payload.roomId}...`);
    
    try {
      const account = await this.treasuryRepository.createAccount(event.payload.roomId);
      this.logger.log(`Created Treasury Account (ID: ${account.id}) for Room ${event.payload.roomId}`);

      const accountCreatedEvent: DomainEventEnvelope<TreasuryAccountCreatedPayload> = {
        eventId: randomUUID(),
        eventName: EventNames.TREASURY_ACCOUNT_CREATED,
        aggregateId: account.id,
        roomId: event.payload.roomId,
        actorId: event.actorId,
        occurredAt: new Date().toISOString(),
        payload: {
          accountId: account.id,
          roomId: event.payload.roomId,
          initialBalance: account.currentBalance.toString(),
        },
        metadata: {
          correlationId: event.metadata.correlationId,
          sourceModule: 'treasury',
        },
      };

      this.eventEmitter.emit(EventNames.TREASURY_ACCOUNT_CREATED, accountCreatedEvent);
    } catch (error) {
      this.logger.error(`Failed to create Treasury Account for Room ${event.payload.roomId}`, error);
    }
  }

  /**
   * Retrieves the current treasury balance and ledger-computed totals.
   */
  async getTreasurySummary(roomId: string) {
    const summary = await this.treasuryRepository.getTreasurySummary(roomId);
    
    if (!summary) {
      throw new NotFoundException({
        code: 'TREASURY_NOT_FOUND',
        message: 'Treasury account not found for this room.',
      });
    }

    // Prisma.Decimal is returned from the sum aggregation. We format to fixed 2 decimal places string.
    // If there are no transactions yet, the sum will be null.
    const totalContributions = summary.totalContributions ? summary.totalContributions.toFixed(2) : '0.00';
    const totalReimbursements = summary.totalReimbursements ? summary.totalReimbursements.toFixed(2) : '0.00';

    return {
      currentBalance: summary.account.currentBalance.toFixed(2),
      totalContributions,
      totalReimbursements,
      currencyCode: summary.account.room.settings?.currencyCode ?? 'INR',
    };
  }

  /**
   * Submits a new contribution and emits an event.
   */
  async submitContribution(roomId: string, userId: string, dto: SubmitContributionDto) {
    const contribution = await this.treasuryRepository.createContribution(roomId, userId, dto.amount, dto.note);

    const eventPayload: DomainEventEnvelope<ContributionSubmittedPayload> = {
      eventId: randomUUID(),
      eventName: EventNames.CONTRIBUTION_SUBMITTED,
      aggregateId: contribution.id,
      roomId,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        contributionId: contribution.id,
        roomId,
        amount: dto.amount,
        submittedBy: userId,
        note: dto.note,
      },
      metadata: {
        correlationId: randomUUID(),
        sourceModule: 'treasury',
      },
    };

    this.eventEmitter.emit(EventNames.CONTRIBUTION_SUBMITTED, eventPayload);
    
    return contribution;
  }

  /**
   * Lists contributions with pagination.
   */
  async listContributions(roomId: string, filters: ListContributionsDto) {
    const { data, totalItems } = await this.treasuryRepository.findContributions(roomId, filters);
    const totalPages = Math.ceil(totalItems / filters.limit);
    
    return {
      data,
      meta: {
        page: filters.page,
        limit: filters.limit,
        totalItems,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1,
      }
    };
  }

  /**
   * Cancels a pending contribution, ensuring only the original contributor can cancel.
   */
  async cancelContribution(roomId: string, userId: string, contributionId: string) {
    const contribution = await this.treasuryRepository.getContributionById(roomId, contributionId);

    if (!contribution) {
      throw new NotFoundException('CONTRIBUTION_NOT_FOUND');
    }

    if (contribution.contributorId !== userId) {
      throw new ForbiddenException('CONTRIBUTION_ACCESS_DENIED');
    }

    if (contribution.status !== 'PENDING') {
      throw new BadRequestException('CONTRIBUTION_CANNOT_CANCEL');
    }

    const updated = await this.treasuryRepository.updateContributionStatus(contributionId, 'CANCELLED');

    const eventPayload: DomainEventEnvelope<ContributionCancelledPayload> = {
      eventId: randomUUID(),
      eventName: EventNames.CONTRIBUTION_CANCELLED,
      aggregateId: contribution.id,
      roomId,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        contributionId: contribution.id,
        roomId,
        cancelledBy: userId,
      },
      metadata: {
        correlationId: randomUUID(),
        sourceModule: 'treasury',
      },
    };

    this.eventEmitter.emit(EventNames.CONTRIBUTION_CANCELLED, eventPayload);

    return updated;
  }
}
