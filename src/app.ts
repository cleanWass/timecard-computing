import { LocalDate } from '@js-joda/core';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { pipe, flow } from 'fp-ts/function';
import * as T from 'fp-ts/lib/Task';
import * as E from 'fp-ts/lib/Either';
import { array } from 'fp-ts/Array';

import * as TE from 'fp-ts/lib/TaskEither';
import { isRight } from 'fp-ts/These';
import { computeTimecardForEmployee } from '../src/application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from '../src/domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/parsing/parse-payload';

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

export const fetchDataForEmployee = (employeeId: string, { start, end }: LocalDateRange) =>
  axios
    .post('http://localhost:3000/extract-cleaner-data-timecard', {
      cleanerId: employeeId,
      period: {
        startDate: start.toString(),
        endDate: end.toString(),
      },
    })
    .then(r => r.data)
    .catch(e => console.log(e));

export const fetchAllCleaners = () =>
  axios.post('http://localhost:3000/cleaners').then(
    r =>
      r.data as {
        id: string;
        type: string;
        firstName: string;
        lastName: string;
      }[]
  );

app.post('/timecard', async (req, res) => {
  const { body, params } = req;
  console.log('/timecard', { body: req.body, params: req.params });
  const {
    cleanerId,
    period: { startDate, endDate },
    // } = req.body;
  } = {
    cleanerId: '003AX000004s8BDYAY', //ivete
    // cleanerId: '003AX00000468tkYAA',
    // cleanerId: '003AX000003gtHMYAY',
    period: { startDate: '2023-11-20', endDate: '2023-12-18' },
  };

  const period = new LocalDateRange(LocalDate.parse(startDate), LocalDate.parse(endDate));

  await pipe(
    TE.tryCatch(
      () => fetchDataForEmployee(cleanerId, period),
      e => new Error(`Fetching from care data parser went wrong ${e}`)
    ),
    TE.chainW(flow(parsePayload, TE.fromEither)),
    TE.map(t => {
      console.log('log intermediaire', t);
      return t;
    }),
    TE.map(flow(formatPayload, computeTimecardForEmployee(period))),
    TE.fold(
      e => {
        console.error('Error in TE.fold:', e);
        return T.of(res.status(500).json({ error: e.message }));
      },
      result => {
        if (isRight(result)) {
          return T.of(res.status(200).json(result.right));
        } else {
          console.error('Error in TE.fold: Expected Right, but got Left', result.left);
          return T.of(res.status(500).json({ error: 'Unexpected result format' }));
        }
      }
    )
  )();
});

const getEmployeeTimecard = (employeeId: string, period: LocalDateRange) =>
  pipe(
    TE.tryCatch(
      () => fetchDataForEmployee(employeeId, period),
      e => new Error(`OOOOO Fetching from care data parser went wrong for cleanerID: ${employeeId} ==> ${e.toString()}`)
    ),
    TE.chainW(flow(parsePayload, TE.fromEither)),
    TE.map(flow(formatPayload, computeTimecardForEmployee(period)))
  );

app.post('/payroll', async (req, res) => {
  const { body, params } = req;
  console.log('/payroll', { body: req.body, params: req.params });
  const {
    cleanerId,
    period: { startDate, endDate },
  } = req.body;

  const period = new LocalDateRange(LocalDate.parse(startDate), LocalDate.parse(endDate));

  const timecards = await pipe(
    TE.tryCatch(
      () => fetchAllCleaners(),
      e => new Error(`Fetching from care data parser went wrong ${e}`)
    ),
    TE.chain(cleaners => {
      return pipe(
        cleaners.slice(0, 10).map(({ id }) => getEmployeeTimecard(id, period)),
        t => t,
        TE.sequenceArray
      );
    }),
    TE.chainW(result => TE.fromEither(E.sequenceArray(result))),
    TE.fold(
      e => {
        console.log(e.message);
        return T.of(res.status(500).json({ error: e.message }));
      },
      result => {
        result.forEach(cl => cl.timecards.forEach(t => t.debug()));
        return T.of(res.status(200).json(result));
      }
    )
  )();
});
