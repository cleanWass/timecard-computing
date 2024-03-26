import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/lib/Either';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';

import * as TE from 'fp-ts/lib/TaskEither';
import { List } from 'immutable';
import { computeTimecardForEmployee } from '../src/application/timecard-computation/compute-timecard-for-employee';
import {
  fetchTimecardData,
  validateApiReturn,
  validateRequestPayload,
} from './infrastructure/server/timecard-route-service';

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
      pipe(data, computeTimecardForEmployee(period), formatTimecardComputationReturn)
    ),
    TE.bind('prospectiveTimecards', ({ params: { period, prospectiveShifts }, data }) =>
      pipe(
        { ...data, shifts: data.shifts.concat(List(prospectiveShifts)) },
        computeTimecardForEmployee(period),
        formatTimecardComputationReturn
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

const formatTimecardComputationReturn = (
  computationResult: ReturnType<ReturnType<typeof computeTimecardForEmployee>>
) => {
  return pipe(
    computationResult,
    E.map(result => ({
      employee: result.employee,
      period: { start: result.period.start.toString(), end: result.period.end.toString() },
      timecards: result.timecards.map(t => ({
        id: t.id,
        shifts: t.shifts.toArray(),
        leaves: t.leaves.toArray(),
        contract: {
          id: t.contract.id,
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
    })),
    TE.fromEither
  );
};
