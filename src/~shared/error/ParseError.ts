import {TypedError} from './TypedError';

export class ParseError extends TypedError {
  constructor(message: string) {
    super('ParseError: ', message);
  }
}
