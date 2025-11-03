import { TypedError } from './typed-error';

export class FetchError extends TypedError {
  constructor(message: string) {
    super('FetchError', message);
  }
}
