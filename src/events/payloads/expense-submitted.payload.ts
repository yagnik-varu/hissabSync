export interface ExpenseSubmittedPayload {
  expenseId: string;
  roomId: string;
  submittedBy: string;
  amount: string; // Preserved as string for Decimal accuracy
  title: string;
}
