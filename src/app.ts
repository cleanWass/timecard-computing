import {LocalDate} from '@js-joda/core';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import {pipe, flow} from 'fp-ts/function';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';
import {isRight} from 'fp-ts/These';
import {computeTimecardForEmployee} from '../src/application/timecard-computation/compute-timecard-for-employee';
import {LocalDateRange} from '../src/domain/models/local-date-range';
import {formatPayload, parsePayload} from './infrastructure/parsing/parse-payload';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

app.listen(PORT, () => {
  console.log(`Timecard Computing Server is running on port ${PORT}`);
});
app.use(
  cors({
    origin: '*', // that will for all like  https / http
  })
);

const fetchDataForEmployee = (employeeId: string, {startDate, endDate}: {startDate: Date; endDate: Date}) =>
  axios
    .post('http://localhost:3000/extract-cleaner-data-timecard', {
      cleanerId: employeeId,
      period: {
        startDate,
        endDate,
      },
    })
    .then(r => r.data);

app.post('/timecard', async (req, res) => {
  const {body, params} = req;
  console.log('/timecard', {body: req.body, params: req.params});
  const {
    cleanerId,
    period: {startDate, endDate},
  } = req.body;

  const period = new LocalDateRange(LocalDate.parse(startDate), LocalDate.parse(endDate));

  await pipe(
    TE.tryCatch(
      () => fetchDataForEmployee(cleanerId, {startDate, endDate}),
      e => new Error(`Fetching from care data parser went wrong ${e}`)
    ),
    TE.chainW(flow(parsePayload, TE.fromEither)),
    TE.map(flow(formatPayload, computeTimecardForEmployee(period))),
    TE.fold(
      e => {
        console.error('Error in TE.fold:', e);
        return T.of(res.status(500).json({error: e.message}));
      },
      result => {
        if (isRight(result)) {
          return T.of(res.status(200).json(result.right));
        } else {
          console.error('Error in TE.fold: Expected Right, but got Left');
          return T.of(res.status(500).json({error: 'Unexpected result format'}));
        }
      }
    )
  )();
});
