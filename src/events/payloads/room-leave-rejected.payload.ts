export interface RoomLeaveRejectedPayload {
  roomId: string;
  userId: string;
  rejectionReason?: string;
}
