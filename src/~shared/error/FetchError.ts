import { TypedError } from './TypedError';

export class FetchError extends TypedError {
  constructor(message: string) {
    super('FetchError', message);
  }
}
