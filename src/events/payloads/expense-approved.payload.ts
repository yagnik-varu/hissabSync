export interface ExpenseApprovedPayload {
  expenseId: string;
  roomId: string;
  submittedBy: string;
  amount: string; // Decimal string
  title: string;
  approvedBy: string;
}
