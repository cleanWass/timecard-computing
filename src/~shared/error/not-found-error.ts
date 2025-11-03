import { TypedError } from './typed-error';

export class NotFoundError extends TypedError {
  constructor(message: string) {
    super('NotFoundError', message);
  }
}
