import { TypedError } from '../../../~shared/error/typed-error';

export class IllegalArgumentError extends TypedError {
  constructor(message: string) {
    super('IllegalArgumentError', message);
  }
}
