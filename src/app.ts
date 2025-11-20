import { LocalDate } from '@js-joda/core';
import * as AWS from 'aws-sdk';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import 'dotenv/config';

import { pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as T from 'fp-ts/lib/Task';

import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { LocalDateRange } from './domain/models/local-date-range';
import { TimecardComputationError } from './domain/~shared/error/timecard-computation-error';
import { generatePayrollExports } from './generate-csv-payroll';
import { formatTimecardComputationReturn } from './infrastructure/formatting/format-timecard-response';
import { handleModulationDataComputationRoute } from './infrastructure/route/modulation-data-computation-route';
import { handleTimecardComputationRoute } from './infrastructure/route/timecard-computation-route';
import { ParseError } from './~shared/error/parse-error';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(bodyParser.json());

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

app.listen(PORT, () => {
  console.log(`Timecard Computing Server is running on port ${PORT}`);
});

app.post('/timecard', async (req, res) => {
  console.log('/timecard', { body: req.body, params: req.params });
  await handleTimecardComputationRoute(req, res)();
});

app.post('/modulation', async (req, res) => {
  console.log('/modulation', { body: req.body, params: req.params });
  await handleModulationDataComputationRoute(req, res)();
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
