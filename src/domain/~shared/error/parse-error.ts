import { TypedError } from '../../../~shared/error/typed-error';

export class ParseError extends TypedError {
  constructor(message: string) {
    super('ParseError', message);
  }
}
