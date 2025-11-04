import './config/env';
import { LocalDate } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { EnvService } from './config/env';
import { serverConfig } from './config/server.config';
import { configureAWS, createS3Client } from './config/aws.config';
import { LocalDateRange } from './domain/models/local-date-range';
import { generatePayrollExports } from './generate-csv-payroll';
import { formatTimecardComputationReturn } from './infrastructure/formatting/format-timecard-response';
import { handleTimecardComputationRoute } from './infrastructure/route/timecard-computation-route';
import { makeApp } from './presentation/http/app';
import { makeS3Service } from './infrastructure/storage/s3/s3.service';

const start = async () => {
  try {
    console.log('🔧 Configuring AWS...');
    configureAWS();

    console.log('📦 Creating dependencies...');
    const s3Client = createS3Client();
    const s3Service = makeS3Service(s3Client);

    console.log('🚀 Creating Express app...');
    const app = makeApp({ s3Service });

    app.listen(serverConfig.port, () => {
      console.log('');
      console.log('✅ Timecard Computing Server is running');
      console.log(`   Port: ${serverConfig.port}`);
      console.log(`   Environment: ${serverConfig.nodeEnv}`);
      console.log(`   AWS Region: ${EnvService.get('AWS_REGION')}`);
      console.log('');
    });

    app.post('/timecard', async (req, res) => {
      console.log('/timecard', { body: req.body, params: req.params });
      await handleTimecardComputationRoute(req, res)();
    });

    app.post('/payroll', async (req, res) => {
      console.log('/payroll', { body: req.body, params: req.params });
      const startDate = LocalDate.parse(req.body.startDate);
      const endDate = LocalDate.parse(req.body.endDate);

      const period = new LocalDateRange(startDate, endDate);
      const env = prepareEnv({
        persistence: 'logs',
        period,
        debug: false,
        displayLog: false,
      });
      await pipe(
        generatePayrollExports({ period, env }),
        TE.map(RA.map(formatTimecardComputationReturn)),
        TE.fold(
          e => {
            console.error('Error in TE.fold:', e);
            return T.of(res.status(500).json({ error: e }));
          },
          result => {
            if (result) {
              return T.of(res.status(200).json(result));
            } else {
              console.error('Error in TE.fold: Expected Right, but got Left', result);
              return T.of(res.status(500).json({ error: 'Unexpected result format' }));
            }
          }
        )
      )();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();
