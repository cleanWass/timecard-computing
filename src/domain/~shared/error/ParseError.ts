import {TypedError} from '../../../~shared/error/TypedError';

export class ParseError extends TypedError {
  constructor(message: string) {
    super('ParseError', message);
  }
}
