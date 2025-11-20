import './config/env';
import { LocalDate } from '@js-joda/core';
import * as AWS from 'aws-sdk';
import { pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import fs from 'fs';
import process from 'node:process';
import path from 'path';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { configureAWS, createS3Client } from './config/aws.config';
import { EnvService } from './config/env';
import { serverConfig } from './config/server.config';
import { LocalDateRange } from './domain/models/local-date-range';
import { TimecardComputationError } from './domain/~shared/error/timecard-computation-error';
import { generatePayrollExports } from './generate-csv-payroll';
import { formatTimecardComputationReturn } from './infrastructure/formatting/format-timecard-response';
import { handleTimecardComputationRoute } from './infrastructure/route/timecard-computation-route';
import { makeS3Service } from './infrastructure/storage/s3/s3.service';
import { makeApp } from './presentation/http/app';
import { ParseError } from './~shared/error/parse-error';
import { generateRequestId, logger } from './~shared/logging/logger';

const start = async () => {
  const log = logger.child({ request_id: generateRequestId(), service: 'main' });

  try {
    log.info('🔧 Configuring AWS...');
    configureAWS();

    log.info('📦 Creating dependencies...');
    const s3Client = createS3Client();
    const s3Service = makeS3Service(s3Client);

    log.info('🚀 Creating Express app...');
    const app = makeApp({ s3Service });

    app.listen(serverConfig.port, () => {
      log.info(`✅ Timecard Computing Server is running`);
      log.info(`\nPort: ${serverConfig.port}`);
      log.info(`\nEnvironment: ${serverConfig.nodeEnv}`);
      log.info(`\nAWS Region: ${EnvService.get('AWS_REGION')}`);
    });

    app.post('/timecard', async (req, res) => {
      log.info('/timecard', { body: req.body, params: req.params });
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

    app.post('/download-export', async (req, res) => {
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
      });

      const s3 = new AWS.S3();

      console.log('/download-export', { body: req.body, params: req.params });
      try {
        const startDate = LocalDate.parse(req.body.startDate);
        const endDate = LocalDate.parse(req.body.endDate);
        const type = req.body.type;
        const fileLabel = req.body.fileLabel;

        const period = new LocalDateRange(startDate, endDate);
        const env = prepareEnv({
          persistence: 'rh',
          period,
          debug: false,
          displayLog: false,
        });

        let error: Error | ParseError | TimecardComputationError | undefined = undefined;
        const result = await pipe(
          generatePayrollExports({ period, env }),
          TE.fold(
            e => {
              console.error('Error in TE.fold:', e);
              error = e;
              return T.of(undefined);
            },
            result => T.of(result)
          )
        )();
        for (const streamName in env.csvStream) {
          env.csvStream[streamName].end();
        }
        if (!error) {
          const filePath = path.join(process.cwd(), `/exports/rendu/${type}.csv`);
          console.log('Uploading file to S3:', filePath);

          const fileStream = fs.createReadStream(filePath);
          console.log('fileLabel');
          const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME || 'payrollexports',
            Key: `exports/${fileLabel}.csv`,
            Body: fileStream,
            ContentType: 'text/csv',
          };
          setTimeout(
            () =>
              s3.upload(uploadParams, (err, data) => {
                if (err) {
                  console.error('Error uploading file:', err);
                  res.status(500).send("Erreur lors de l'envoi du fichier sur S3.");
                } else {
                  console.log('File uploaded successfully:', data.Location);
                  res.status(200).json({ downloadUrl: data.Location });
                }
              }),
            5000
          );
        } else {
          console.error('Error in TE.fold: Expected Right, but got Left', result);
          res.status(500).json({ error });
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  } catch (error) {
    log.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();
