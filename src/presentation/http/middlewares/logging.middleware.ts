import { Request, Response, NextFunction } from 'express';
import { generateRequestId, logger } from '../../../~shared/logging/logger';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

export const httpLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  logger.info('HTTP Request', {
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: sanitizeBody(req.body),
    ip: req.ip,
    user_agent: req.get('user-agent'),
  });

  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logger.info('HTTP Response', {
      request_id: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      response_size: Buffer.byteLength(JSON.stringify(data)),
    });

    return originalSend.call(this, data);
  };

  next();
};

const sanitizeBody = (body: any): any => {
  if (!body) return body;

  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  const sanitized = { ...body };

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
};

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
