import { Duration, LocalDate, LocalDateTime } from '@js-joda/core';
import axios from 'axios';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List } from 'immutable';
import { LeavePeriod } from '../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { ProspectiveShift } from '../../domain/models/mission-delivery/shift/prospective-shift';
import { fetchPayrollData } from '../../generate-csv-payroll';
import { FetchError } from '../../~shared/error/fetch-error';
import { ParseError } from '../../~shared/error/parse-error';
import { employeeDataValidator } from '../validation/extern/employee';
import { timecardRoutesPayloadValidator } from '../validation/routes/timecard-route-payload';
import { createParser } from '../validation/validate-payload';

interface TimecardRouteParams {
  silaeId: string;
  period: LocalDateRange;
  prospectiveShifts?: ProspectiveShift[];
}

export const fetchEmployeeDataFromCache = (period: LocalDateRange) =>
  TE.tryCatch(
    () => fetchPayrollData(period),
    e => {
      console.log(`Fetching cached data went wrong ${e}`);
      return new Error(`Fetching cached data from care data parser went wrong ${e}`);
    }
  );

export const fetchDataForEmployee = async (silaeId: string, { start, end }: LocalDateRange) => {
  const url = `${process.env.CARE_DATA_PARSER_URL || 'http://localhost:3000'}/employee-data`;
  try {
    const r = await axios.post(url, {
      silaeId,
      period: {
        startDate: start.toString(),
        endDate: end.toString(),
      },
    });
    return r.data;
  } catch (e) {
    return console.log(`error while fetching for ${silaeId} ${JSON.stringify(e.response.data)}`);
  }
};

export const fetchActiveCleanersForPeriod = async ({ start, end }: LocalDateRange) => {
  const url = `${process.env.CARE_DATA_PARSER_URL || 'http://localhost:3000'}/active-cleaners`;
  const r = await axios.post(url, {
    period: {
      startDate: start.toString(),
      endDate: end.toString(),
    },
  });
  return r.data as {
    [key in 'silaeId' | 'id' | 'role' | 'firstName' | 'lastName']: string;
  }[];
  // .catch(e => {
  //   console.log(`error while fetching activeCleaners ${e.response.data}`);
  //   return new FetchError('error while fetching activeCleaners');
  // });
};

export const parseRequestPayload = (payload: unknown) =>
  createParser(timecardRoutesPayloadValidator).parse(payload);

export const formatRequestPayload = (data: ReturnType<typeof parseRequestPayload>) =>
  pipe(
    data,
    E.map(
      raw =>
        ({
          ...raw,
          period: new LocalDateRange(
            LocalDate.parse(raw.period.start),
            LocalDate.parse(raw.period.end)
          ),
          prospectiveShifts: raw.prospectiveShifts.map(
            ({ startTime, duration, employeeId, clientId, clientName }) =>
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

export const parseEmployeeDataApiReturn = (data: unknown) =>
  createParser(employeeDataValidator).parse(data);

export const formatEmployeeDataApiReturn = (data: ReturnType<typeof parseEmployeeDataApiReturn>) =>
  pipe(
    data,
    E.map(({ contracts, employee, leaves, shifts }) => ({
      employee,
      shifts: List(shifts),
      leaves: List(leaves),
      // FIXME  Leaves periods shouldn't be this
      leavePeriods: List<LeavePeriod>(),
      contracts: List(contracts),
    }))
  );

export const validateRequestPayload = (payload: unknown) =>
  pipe(payload, parseRequestPayload, formatRequestPayload);

export const fetchTimecardData = ({ silaeId, period }: TimecardRouteParams) =>
  TE.tryCatch(
    () => fetchDataForEmployee(silaeId, period),
    e => new ParseError(`Fetching from care data parser went wrong ${e}`)
  );

export const fetchTimecardDataForEmployees = (period: LocalDateRange) =>
  TE.tryCatchK(
    () => fetchActiveCleanersForPeriod(period),
    e => new FetchError(`Fetching from care data parser went wrong ${e}`)
  )();

export const validateEmployeeDataApiReturn = (data: unknown) =>
  pipe(data, parseEmployeeDataApiReturn, formatEmployeeDataApiReturn, TE.fromEither);
