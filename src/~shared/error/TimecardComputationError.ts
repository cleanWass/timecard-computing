import { TypedError } from './TypedError';

export class TimecardComputationError extends TypedError {
  constructor(message: string) {
    super('TimecardComputationError', message);
  }
}
