import { TypedError } from './typed-error';

export class ValidationError extends TypedError {
  constructor(message: string) {
    super('ValidationError', message);
  }
}
