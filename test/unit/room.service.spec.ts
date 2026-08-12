import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoomService } from '../../src/modules/room/services/room.service';
import { RoomRepository } from '../../src/modules/room/repositories/room.repository';

describe('RoomService', () => {
  let roomService: RoomService;
  let roomRepository: jest.Mocked<RoomRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockRoomRepository = {
      createRoomWithSettingsAndMember: jest.fn(),
      findUserRooms: jest.fn(),
      findRoomDetails: jest.fn(),
      findRoomById: jest.fn(),
      updateRoomDetails: jest.fn(),
      updateRoomSettings: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: RoomRepository, useValue: mockRoomRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    roomService = module.get<RoomService>(RoomService);
    roomRepository = module.get(RoomRepository) as jest.Mocked<RoomRepository>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('createRoom', () => {
    it('should create a room, add creator as admin, and emit ROOM_CREATED', async () => {
      const dto = { name: 'Test Room', description: 'desc', currencyCode: 'USD', allowNegativeTreasury: true };
      const userId = 'user-123';
      
      const mockRoom = { id: 'room-1', name: 'Test Room', roomCode: 'TEST1', description: 'desc', status: 'ACTIVE', createdBy: userId, createdAt: new Date() };
      const mockSettings = { currencyCode: 'USD', allowNegativeTreasury: true };
      const mockMember = { id: 'mem-1', role: 'ADMIN' };
      
      roomRepository.createRoomWithSettingsAndMember.mockResolvedValue({
        room: mockRoom,
        settings: mockSettings,
        member: mockMember
      } as any);

      const result = await roomService.createRoom(userId, dto as any);

      expect(roomRepository.createRoomWithSettingsAndMember).toHaveBeenCalledWith({
        name: dto.name,
        roomCode: expect.any(String),
        description: dto.description,
        createdBy: userId,
        currencyCode: dto.currencyCode,
        allowNegativeTreasury: dto.allowNegativeTreasury,
      });
      expect(result).toEqual({
        id: mockRoom.id,
        name: mockRoom.name,
        roomCode: mockRoom.roomCode,
        description: mockRoom.description,
        status: mockRoom.status,
        createdBy: mockRoom.createdBy,
        createdAt: mockRoom.createdAt,
        myRole: mockMember.role,
        settings: {
          currencyCode: mockSettings.currencyCode,
          allowNegativeTreasury: mockSettings.allowNegativeTreasury,
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('room.created', expect.any(Object));
    });
  });
});
