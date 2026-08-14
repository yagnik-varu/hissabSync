export interface ReimbursementCreatedPayload {
  reimbursementId: string;
  expenseId: string;
  roomId: string;
  beneficiaryId: string;
  amount: string; // Decimal string
}
