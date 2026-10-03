/** An expected failure with a message that is safe to show to the user. */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export class ConflictError extends ServiceError {
  constructor() {
    super("This event was changed elsewhere (another tab or device). Reload the page and try again.");
    this.name = "ConflictError";
  }
}
