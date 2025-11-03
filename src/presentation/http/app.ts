import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { corsConfig } from '../../config/cors.config';
import { S3Service } from '../../infrastructure/storage/s3/s3.service';
import { errorHandler } from './middlewares/error-handler';
import { httpLoggingMiddleware, requestIdMiddleware } from './middlewares/logging.middleware';
import { makeRoutes } from './routes';

export type AppDependencies = {
  s3Service: S3Service;
};

export const makeApp = (dependencies: AppDependencies): Express => {
  const app = express();

  // ══════════════════════════════════════════════════════════════════════
  // MIDDLEWARES GLOBAUX
  // ══════════════════════════════════════════════════════════════════════

  app.use(cors(corsConfig));
  app.use(bodyParser.json());
  app.use(requestIdMiddleware);
  app.use(httpLoggingMiddleware);

  // ══════════════════════════════════════════════════════════════════════
  // ROUTES
  // ══════════════════════════════════════════════════════════════════════

  const routes = makeRoutes(dependencies);
  app.use('/api', routes);

  // ══════════════════════════════════════════════════════════════════════
  // ERROR HANDLER (doit être en dernier)
  // ══════════════════════════════════════════════════════════════════════

  app.use(errorHandler);

  return app;
};
