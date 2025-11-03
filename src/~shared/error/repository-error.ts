import {TypedError} from './typed-error';

export class RepositoryError extends TypedError {
  constructor(message: string) {
    super('RepositoryError', message);
  }
}
