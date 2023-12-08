import {TypedError} from './TypedError';

export class RepositoryError extends TypedError {
  constructor(message: string) {
    super('RepositoryError', message);
  }
}
