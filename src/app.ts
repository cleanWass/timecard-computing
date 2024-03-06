import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { flow, pipe } from 'fp-ts/function';
import * as E from 'fp-ts/lib/Either';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';

import * as TE from 'fp-ts/lib/TaskEither';
import { isRight } from 'fp-ts/These';
import { computeTimecardForEmployee } from '../src/application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from '../src/domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/parsing/parse-payload';
import { planningValidator } from './infrastructure/parsing/schema/planning';

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

export const fetchDataForEmployee = (silaeId: string, { start, end }: LocalDateRange) =>
  axios
    .post('http://localhost:3000/employee-data', {
      silaeId,
      period: {
        startDate: start.toString(),
        endDate: end.toString(),
      },
    })
    .then(r => r.data)
    .catch(e => console.log(`error while fetching for ${silaeId} ${e.response.data}`));

export const fetchEmployeeWithActiveContractDuringPeriod = ({ start, end }: LocalDateRange) => {
  const token = 'zkrgnflp124jffdlj449FkAAZ'; // TODO env
  const baseURl = 'https://cleany-help-rh-herokuapp-com'; // TODO env

  const url = 'http://localhost:3000/active-cleaners';

  const url1 = `${baseURl}/bases/${start.format(DateTimeFormatter.ofPattern('yyyy-MM-dd'))}/${end.format(
    DateTimeFormatter.ofPattern('yyyy-MM-dd')
  )}}/${token}`;

  return axios
    .post(url, {
      period: {
        startDate: start.toString(),
        endDate: end.toString(),
      },
    })
    .then(r => {
      return r.data as {
        id: string;
        type: string;
        firstName: string;
        lastName: string;
        silaeId: string;
      }[];
    });
};

app.post('/timecard', async (req, res) => {
  const { body, params } = req;
  console.log('/timecard', { body: req.body, params: req.params });
  const {
    silaeId,
    period: { startDate, endDate },
    previewShifts,
  } = req.body;

  const period = new LocalDateRange(LocalDate.parse(startDate), LocalDate.parse(endDate));

  await pipe(
    TE.tryCatch(
      () => fetchDataForEmployee(silaeId, period),
      e => new Error(`Fetching from care data parser went wrong ${e}`)
    ),
    TE.chainW(flow(parsePayload, TE.fromEither)),
    TE.map(
      flow(
        formatPayload,
        computeTimecardForEmployee(period),
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
            period: { start: t.workingPeriod.period.start.toString(), end: t.workingPeriod.period.end.toString() },
          })),
        }))
      )
    ),
    TE.fold(
      e => {
        console.error('Error in TE.fold:', e);
        return T.of(res.status(500).json({ error: e }));
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
