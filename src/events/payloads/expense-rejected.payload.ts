export interface ExpenseRejectedPayload {
  expenseId: string;
  roomId: string;
  rejectedBy: string;
  reason: string;
}
