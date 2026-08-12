/**
 * Payload shape for the `treasury.account.created` domain event.
 *
 * @see docs/03-event-storming.md §2 (Create Room side effects)
 */
export interface TreasuryAccountCreatedPayload {
  accountId: string;
  roomId: string;
  initialBalance: string;
}
