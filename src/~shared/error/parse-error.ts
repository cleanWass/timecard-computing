import { TypedError } from './typed-error';

export class ParseError extends TypedError {
  constructor(message: string) {
    super('ParseError: ', message);
  }
}
