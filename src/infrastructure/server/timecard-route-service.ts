import { Duration, LocalDate, LocalDateTime } from '@js-joda/core';
import axios from 'axios';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List } from 'immutable';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { ProspectiveShift } from '../../domain/models/mission-delivery/shift/prospective-shift';
import { ParseError } from '../../~shared/error/ParseError';
import { employeeDataValidator } from '../validation/extern/employee';
import { timecardRoutesPayloadValidator } from '../validation/routes/timecard-route-payload';
import { validateRoutePayload } from '../validation/validate-route-payload';

interface TimecardRouteParams {
  silaeId: string;
  period: LocalDateRange;
  prospectiveShifts: ProspectiveShift[];
}

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

export const parseRequestPayload = (payload: unknown) => validateRoutePayload(timecardRoutesPayloadValidator)(payload);

export const formatRequestPayload = (data: ReturnType<typeof parseRequestPayload>) =>
  pipe(
    data,
    E.map(
      raw =>
        ({
          ...raw,
          period: new LocalDateRange(LocalDate.parse(raw.period.start), LocalDate.parse(raw.period.end)),
          prospectiveShifts: raw.prospectiveShifts.map(({ startTime, duration, employeeId, clientId, clientName }) =>
            ProspectiveShift.build({
              id: `ProspectiveShift-${ProspectiveShift.count++}`,
              startTime: LocalDateTime.parse(startTime),
              duration: Duration.parse(duration),
              employeeId,
              clientId,
              clientName,
            })
          ),
        }) satisfies TimecardRouteParams
    )
  );

export const parseApiReturn = (data: unknown) =>
  pipe(
    data,
    employeeDataValidator.safeParse,
    E.fromPredicate(
      parsedJSON => parsedJSON.success && parsedJSON?.data !== null,
      e => new ParseError(`safe parse success : ${e.success} \n Error while parsing payload 2 ${e['error']}`)
    ),
    E.chain(parsedJSON => (parsedJSON.success ? E.right(parsedJSON.data) : E.left(new ParseError('data is empty'))))
  );

export const formatApiReturn = (data: ReturnType<typeof parseApiReturn>) =>
  pipe(
    data,
    E.map(({ contracts, employee, leaves, shifts }) => ({
      employee,
      shifts: List(shifts),
      leaves: List(leaves),
      contracts: List(contracts),
    }))
  );

export const validateRequestPayload = (payload: unknown) => pipe(payload, parseRequestPayload, formatRequestPayload);

export const fetchTimecardData = ({ silaeId, period }: TimecardRouteParams) =>
  TE.tryCatch(
    () => fetchDataForEmployee(silaeId, period),
    e => new ParseError(`Fetching from care data parser went wrong ${e}`)
  );

export const validateApiReturn = (data: unknown) => pipe(data, parseApiReturn, formatApiReturn);
