/**
 * Payload shape for the `room.created` domain event.
 *
 * @see docs/03-event-storming.md §2 (Create Room)
 */
export interface RoomCreatedPayload {
  roomId: string;
  roomName: string;
  roomCode: string;
  createdBy: string;
  currencyCode: string;
  allowNegativeTreasury: boolean;
}
