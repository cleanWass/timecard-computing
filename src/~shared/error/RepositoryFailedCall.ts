import {TypedError} from './TypedError';

export class RepositoryFailedCall extends TypedError {
  constructor(message: string) {
    super('RepositoryFailedCall: ', message);
  }
}
