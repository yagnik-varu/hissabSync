export interface ContributionRejectedPayload {
  contributionId: string;
  roomId: string;
  rejectedBy: string;
  reason?: string;
}
