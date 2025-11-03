import { Request, Response, NextFunction } from 'express';

import { TimecardComputationError } from '../../../domain/~shared/error/timecard-computation-error';
import { ParseError } from '../../../~shared/error/parse-error';

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Handler]', error);

  if (error instanceof ParseError) {
    return res.status(400).json({
      error: 'Parse error',
      message: error.message,
    });
  }

  if (error instanceof TimecardComputationError) {
    return res.status(422).json({
      error: 'Timecard computation error',
      message: error.message,
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    message: error.message,
  });
};
