export class TypedError extends Error {
  constructor(public readonly type: string, message: string) {
    super(message);
  }
}
