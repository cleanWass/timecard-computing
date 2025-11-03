import { TypedError } from '../../../~shared/error/typed-error';

export class TimecardComputationError extends TypedError {
  constructor(message: string) {
    super('TimecardComputationError', message);
  }
}
