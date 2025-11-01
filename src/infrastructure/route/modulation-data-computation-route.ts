import express from 'express';
import 'dotenv/config';

import { pipe } from 'fp-ts/function';
import * as T from 'fp-ts/lib/Task';

import * as TE from 'fp-ts/lib/TaskEither';
import { computeModulationDataForEmployee } from '../../application/modulation-computation/compute-modulation-data-for-employee';
import {
  fetchTimecardData,
  validateEmployeeDataApiReturn,
  validateRequestPayload,
} from '../server/timecard-route-service';

export const handleModulationDataComputationRoute = (
  req: express.Request,
  res: express.Response
) => {
  return pipe(
    TE.Do,
    TE.bind('params', () => TE.fromEither(validateRequestPayload(req.body))),
    TE.bind('raw', ({ params }) => fetchTimecardData(params)),
    TE.bind('data', ({ raw }) => validateEmployeeDataApiReturn(raw)),
    TE.bind('modulationData', ({ params: { period }, data }) =>
      pipe(data, computeModulationDataForEmployee(period), TE.fromEither)
    ),
    // TE.bind('prospectiveTimecards', ({ params: { period, prospectiveShifts }, data }) =>
    //   pipe(
    //     { ...data, shifts: data.shifts.concat(List(prospectiveShifts)) },
    //     computeTimecardForEmployee(period),
    //     E.map(formatTimecardComputationReturn),
    //     TE.fromEither
    //   )
    // ),
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
  );
};
