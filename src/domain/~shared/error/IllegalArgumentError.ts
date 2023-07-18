import {TypedError} from '@shared/error/TypedError';

export class IllegalArgumentError extends TypedError {
  constructor(message: string) {
    super('IllegalArgumentError', message);
  }
}
