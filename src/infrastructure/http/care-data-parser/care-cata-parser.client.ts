import axios, { AxiosInstance } from 'axios';
import { flow } from 'fp-ts/function';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import { CareDataParserClient } from '../../../application/ports/services/care-data-parser-client';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { FetchError } from '../../../~shared/error/fetch-error';
import { mapApiEmployeeDataToEmployeeData } from './mappers/api-employee-data.mapper';

export const makeCareDataParserClient = (config: {
  baseUrl: string;
  apiKey: string;
}): CareDataParserClient => {
  const client: AxiosInstance = axios.create({
    baseURL: config.baseUrl,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    getIntercontractEmployees: (period: LocalDateRange) => {
      return pipe(
        TE.tryCatch(
          () =>
            client.post('/intercontract', {
              startDate: period.start.toString(),
              endDate: period.end.toString(),
            }),
          error =>
            new FetchError(`API Care-data-parser:
          Failed to fetch intercontract employees: ${error}`)
        ),
        TE.map(response => response.data as Array<unknown>),
        TE.chainW(TE.traverseArray(flow(mapApiEmployeeDataToEmployeeData, TE.fromEither)))
      );
    },

    getEmployeeData: ({ silaeId, period }) =>
      pipe(
        TE.tryCatch(
          () =>
            client.post(`/employees/${silaeId}/data`, {
              startDate: period.start.toString(),
              endDate: period.end.toString(),
            }),
          error =>
            new FetchError(`API Care-data-parser:
          Failed to fetch employee data: ${error}`)
        ),
        TE.chainW(flow(mapApiEmployeeDataToEmployeeData, TE.fromEither))
      ),

    createBenchAffectations: ({ silaeId, affectations }) =>
      pipe(
        TE.tryCatch(
          () =>
            client.post(`/employees/${silaeId}/benches`, {
              affectations: affectations,
              // .map(mapBenchAffectationToApiPayload),
            }),
          error =>
            new FetchError(`API Care-data-parser:
          Failed to create bench affectations: ${error}`)
        ),
        TE.map(() => undefined)
      ),
  };
};
