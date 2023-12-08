import { TypedError } from '../../../~shared/error/TypedError';


export class ExpectedAggregateNotFoundError extends TypedError {
  constructor(message: string) {
    super('ExpectedAggregateNotFoundError', message);
  }
}
