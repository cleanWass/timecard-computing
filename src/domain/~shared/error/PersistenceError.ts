import {TypedError} from '../../../~shared/error/TypedError';

export class PersistenceError extends TypedError {
  constructor(message: string) {
    super('PersistenceError', message);
  }
}
