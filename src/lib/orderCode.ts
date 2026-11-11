/** Human-friendly order number derived from the order id, e.g. "GS-4F9K2A1Z". */
export function orderCode(orderId: string): string {
  return `GS-${orderId.slice(-8).toUpperCase()}`;
}
