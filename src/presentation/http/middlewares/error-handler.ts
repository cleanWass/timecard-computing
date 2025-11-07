// presentation/http/middlewares/error-handler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { TimecardComputationError } from '../../../domain/~shared/error/timecard-computation-error';
import { ValidationError } from '../../../~shared/error/validation-error';
import { logger } from '../../../~shared/logging/logger';

export const errorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const log = logger.child({
    request_id: req.requestId,
    error_handler: true,
  });

  log.error('Unhandled error', {
    error_name: error.name,
    error_message: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    body: req.body,
  });

  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message,
    });
  }

  if (error instanceof TimecardComputationError) {
    return res.status(422).json({
      error: 'Timecard computation failed',
      message: error.message,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    request_id: req.requestId,
  });
};
