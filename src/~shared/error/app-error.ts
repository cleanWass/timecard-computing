import { TypedError } from './typed-error';

export class RepositoryFailedCallError extends TypedError {
  constructor(message: string) {
    super('RepositoryFailedCallError: ', message);
  }
}
