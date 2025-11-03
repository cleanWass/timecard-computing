import { TypedError } from '../../../~shared/error/typed-error';

export class PersistenceError extends TypedError {
  constructor(message: string) {
    super('PersistenceError', message);
  }
}
