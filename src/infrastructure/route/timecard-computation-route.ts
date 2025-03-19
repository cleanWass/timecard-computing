import express from 'express';
import 'dotenv/config';

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/lib/Either';
import * as T from 'fp-ts/lib/Task';

import * as TE from 'fp-ts/lib/TaskEither';
import { List } from 'immutable';
import { computeTimecardForEmployee } from '../../application/timecard-computation/compute-timecard-for-employee';
import { formatTimecardComputationReturn } from '../formatting/format-timecard-response';
import {
  fetchTimecardData,
  validateApiReturn,
  validateRequestPayload,
} from '../server/timecard-route-service';

export const handleTimecardComputationRoute = (req: express.Request, res: express.Response) => {
  return pipe(
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
  )
}
