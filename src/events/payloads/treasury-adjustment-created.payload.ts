export interface TreasuryAdjustmentCreatedPayload {
  transactionId: string;
  roomId: string;
  adminId: string;
  transactionType: 'CREDIT' | 'DEBIT';
  amount: string;
  description: string;
}
