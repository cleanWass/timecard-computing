import {TypedError} from './TypedError';

export class IllegalArgumentError extends TypedError {
  constructor(message: string) {
    super('IllegalArgumentError', message);
  }
}
