import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { RoomController } from './controllers/room.controller';
import { MemberController } from './controllers/member.controller';
import { RoomService } from './services/room.service';
import { MemberService } from './services/member.service';
import { RoomRepository } from './repositories/room.repository';
import { MemberRepository } from './repositories/member.repository';

/**
 * RoomModule — manages room lifecycle, memberships, and join requests.
 *
 * Exports RoomService and MemberService so other modules (Treasury, Expense)
 * can query room/membership data via the service interface, never by
 * importing repositories or hitting Room-owned tables directly.
 *
 * EventEmitterModule is imported to allow RoomService to emit domain events
 * (e.g. `room.created`) that downstream modules can listen to without
 * creating direct dependencies.
 *
 * @see docs/11-repository-structure.md §4 (cross-module boundary rules)
 */
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AuthModule,
    AuditModule,
  ],
  controllers: [RoomController, MemberController],
  providers: [
    RoomService,
    MemberService,
    RoomRepository,
    MemberRepository,
  ],
  exports: [RoomService, MemberService],
})
export class RoomModule {}
