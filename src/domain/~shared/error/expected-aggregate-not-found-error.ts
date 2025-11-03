import { TypedError } from '../../../~shared/error/typed-error';

export class ExpectedAggregateNotFoundError extends TypedError {
  constructor(message: string) {
    super('ExpectedAggregateNotFoundError', message);
  }
}
