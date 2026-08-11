import { Module } from '@nestjs/common';
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
 * @see docs/11-repository-structure.md §4 (cross-module boundary rules)
 */
@Module({
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
