import { LocalDate } from '@js-joda/core';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

import { pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as E from 'fp-ts/lib/Either';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';

import * as TE from 'fp-ts/lib/TaskEither';
import { List } from 'immutable';
import * as path from 'node:path';
import { computeTimecardForEmployee } from '../src/application/timecard-computation/compute-timecard-for-employee';
import { TimecardComputationResult } from './application/csv-generation/export-csv';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { LocalDateRange } from './domain/models/local-date-range';
import { generatePayrollExports } from './generate-csv-payroll';
import {
  fetchTimecardData,
  validateApiReturn,
  validateRequestPayload,
} from './infrastructure/server/timecard-route-service';
import { ParseError } from './~shared/error/ParseError';
import { TimecardComputationError } from './~shared/error/TimecardComputationError';
import { ExtractEitherRightType } from './~shared/util/types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

app.listen(PORT, () => {
  console.log(`Timecard Computing Server is running on port ${PORT}`);
});

app.use(
  cors({
    origin: '*',
  })
);

app.post('/timecard', async (req, res) => {
  console.log('/timecard', { body: req.body, params: req.params });

  await pipe(
    TE.Do,
    TE.bind('params', () => TE.fromEither(validateRequestPayload(req.body))),
    TE.bind('raw', ({ params }) => fetchTimecardData(params)),
    TE.bind('data', ({ raw }) => pipe(raw, validateApiReturn, TE.fromEither)),
    TE.bind('timecards', ({ params: { period }, data }) =>
      pipe(data, computeTimecardForEmployee(period), E.map(formatTimecardComputationReturn), TE.fromEither)
    ),
    TE.bind('prospectiveTimecards', ({ params: { period, prospectiveShifts }, data }) =>
      pipe(
        { ...data, shifts: data.shifts.concat(List(prospectiveShifts)) },
        computeTimecardForEmployee(period),
        E.map(formatTimecardComputationReturn),
        TE.fromEither
      )
    ),
    TE.map(({ timecards, prospectiveTimecards }) => ({
      ...timecards,
      prospectiveTimecards: prospectiveTimecards.timecards,
    })),
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

app.post('/payroll', async (req, res) => {
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
  try {
    const startDate = LocalDate.parse(req.body.startDate);
    const endDate = LocalDate.parse(req.body.endDate);
    const type = req.body.type;

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
      TE.map(RA.map(formatTimecardComputationReturn)),
      TE.tap(results => TE.of(results)),
      TE.fold(
        e => {
          console.error('Error in TE.fold:', e);
          error = e;
          return T.of(undefined);
        },
        result => T.of(result)
      )
    )();

    setTimeout(() => {
      if (!error) {
        const filePath = path.join(process.cwd(), `/exports/rendu/${type}.csv`);
        console.log('Sending file:', filePath);
        res.sendFile(filePath, err => {
          if (err) {
            console.error("Erreur lors de l'envoi du fichier :", err);
            res.status(500).send("Erreur lors de l'envoi du fichier.");
          }
        });
      } else {
        console.error('Error in TE.fold: Expected Right, but got Left', result);
        res.status(500).json({ error });
      }
    }, 5000);
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const formatTimecardComputationReturn = (result: TimecardComputationResult) => ({
  employee: result.employee,
  period: { start: result.period.start.toString(), end: result.period.end.toString() },
  timecards: result.timecards.map(t => ({
    id: t.id,
    shifts: t.shifts.toArray(),
    leaves: t.leaves.toArray(),
    contract: {
      id: t.contract.id,
      initialId: t.contract.initialId,
      startDate: t.contract.startDate.toString(),
      endDate: pipe(
        t.contract.endDate,
        O.fold(
          () => undefined,
          e => e.toString()
        )
      ),
      type: t.contract.type,
      subType: t.contract.subType,
      weeklyTotalWorkedHours: t.contract.weeklyTotalWorkedHours.toString(),
      weeklyPlannings: t.contract.weeklyPlannings
        .map((planning, period) => ({
          period: { start: period.start.toString(), end: period.end.toString() },
          planning: planning.toJSON(),
        }))
        .valueSeq()
        .toArray(),
    },
    workedHours: t.workedHours.toObject(),
    mealTickets: t.mealTickets,
    rentability: t.rentability,
    period: { start: t.workingPeriod.period.start.toString(), end: t.workingPeriod.period.end.toString() },
  })),
});
