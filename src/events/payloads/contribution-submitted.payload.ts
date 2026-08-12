export interface ContributionSubmittedPayload {
  contributionId: string;
  roomId: string;
  amount: string;
  submittedBy: string;
  note?: string;
}
