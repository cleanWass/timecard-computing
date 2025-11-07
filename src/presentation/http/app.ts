import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { benchManagementUseCases } from '../../application/use-cases/manage-benches';
import { corsConfig } from '../../config/cors.config';
import { EnvService } from '../../config/env';
import { makeCareDataParserClient } from '../../infrastructure/http/care-data-parser/care-cata-parser.client';
import { makeCreateMissingBenchesScheduler } from '../../infrastructure/scheduling/bench-generation-scheduler.service';
import { schedulerConfig } from '../../infrastructure/scheduling/scheduler.config';
import { S3Service } from '../../infrastructure/storage/s3/s3.service';
import { errorHandlerMiddleware } from './middlewares/error-handler';
import { httpLoggingMiddleware, requestIdMiddleware } from './middlewares/logging.middleware';
import { makeRoutes } from './routes';

export type AppDependencies = {
  s3Service: S3Service;
};

export const makeApp = (dependencies: AppDependencies): Express => {
  const app = express();
  const careDataParserClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL', 'http://localhost:3000'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY', ''),
  });
  const benchManagementScheduler = makeCreateMissingBenchesScheduler(
    benchManagementUseCases(careDataParserClient),
    schedulerConfig.benchManagement
  );

  app.use(cors(corsConfig));
  app.use(bodyParser.json());
  app.use(requestIdMiddleware);
  app.use(httpLoggingMiddleware);

  const routes = makeRoutes(dependencies);
  app.use('', routes);

  benchManagementScheduler.start();

  app.use(errorHandlerMiddleware);

  return app;
};
