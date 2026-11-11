/** A business-rule failure whose message is safe to show to the user. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "DomainError";
  }
}
