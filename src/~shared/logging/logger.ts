import { LocalDateTime } from '@js-joda/core';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { EnvService } from '../../config/env';

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;

    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

export const logger = winston.createLogger({
  level: EnvService.get('LOG_LEVEL', 'info'),
  format: jsonFormat,
  defaultMeta: {
    service: 'timecard-computing',
    environment: EnvService.get('NODE_ENV', 'development') || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: EnvService.get('NODE_ENV', 'info') === 'production' ? consoleFormat : consoleFormat,
    }),

    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

export const createContextLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

export const generateRequestId = (): string => LocalDateTime.now().toString() + '-';
