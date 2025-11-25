import { DateTimeFormatter, LocalDateTime } from '@js-joda/core';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Map, Set } from 'immutable';
import { EnvService } from '../../../config/env';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { manageBenchesService } from '../../../domain/services/bench-management/bench-management.service';
import { IllegalArgumentError } from '../../../domain/~shared/error/illegal-argument-error';
import { TimecardComputationResult } from '../../csv-generation/export-csv';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';
import { FileStoragePort, UploadFileResult } from '../../ports/services/file-storage-port';
import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeGenerateBenchManagementListUseCase = {
  execute: (params: {
    period: LocalDateRange;
  }) => TE.TaskEither<Error | IllegalArgumentError, ReadonlyArray<UploadFileResult>>;
};

export const makeGenerateBenchManagementListUseCase =
  (careDataParserClient: CareDataParserClient) =>
  (fileStoragePort: FileStoragePort): MakeGenerateBenchManagementListUseCase => ({
    execute: ({ period }) =>
      pipe(
        TE.Do,
        TE.tapIO(() => () => console.log('1/ Generate bench management list use case started')),
        TE.bind('benchedEmployees', () =>
          careDataParserClient.getEmployeesWithBenchGeneration(period)
        ),
        TE.tapIO(() => () => console.log('2/Benched employees fetched')),
        TE.bind('benchedTimecards', ({ benchedEmployees }) =>
          pipe(
            benchedEmployees ?? [],
            TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither)),
            TE.map(compResult =>
              compResult.reduce(
                (acc, cur) => acc.set(cur.employee, cur),
                Map<Employee, TimecardComputationResult>()
              )
            )
          )
        ),
        TE.tapIO(() => () => console.log('3/ Benched employees timecards fetched')),
        TE.bind('activeEmployees', ({ benchedEmployees }) =>
          pipe(
            careDataParserClient.getAllActiveEmployeesData(period),
            TE.map(allActive => {
              const benchedIds = Set(benchedEmployees.map(e => e.employee.silaeId));
              return allActive.filter(e => !benchedIds.has(e.employee.silaeId));
            })
          )
        ),
        TE.tapIO(() => () => console.log('4/ Active employees fetched')),
        TE.bind('activeTimecards', ({ activeEmployees }) =>
          pipe(
            activeEmployees,
            TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
          )
        ),
        TE.tapIO(() => () => console.log('5/ Active employees timecards fetched')),
        TE.bind('weeks', () => TE.of(period.divideIntoCalendarWeeks())),
        TE.tapIO(() => () => console.log('6/ Weeks computed')),
        TE.bind('csvContent', ({ weeks, benchedTimecards, activeTimecards }) =>
          TE.of(
            manageBenchesService.generateBenchManagementList({
              period,
              weeks,
              benchedEmployeesTimecard: benchedTimecards,
            })
          )
        ),
        TE.bind(`versioningFileName`, () => {
          const timestamp = LocalDateTime.now().format(
            DateTimeFormatter.ofPattern('yyyy/yyMMddHHmm')
          );
          return TE.of(`bench-management-list/records/${timestamp}.csv`);
        }),
        TE.bind('mainFileName', () => TE.of('bench-management-list/bench-management-list.csv')),
        TE.chainW(({ csvContent, versioningFileName, mainFileName }) => {
          const uploadOptions = {
            bucketName: EnvService.get('AWS_S3_BENCH_MANAGEMENT_BUCKET_NAME'),
            contentType: 'text/csv',
            content: csvContent,
          };
          const uploads = [
            fileStoragePort.uploadFile({ fileName: versioningFileName, ...uploadOptions }),
            fileStoragePort.uploadFile({ fileName: mainFileName, ...uploadOptions }),
          ];

          return pipe(uploads, TE.sequenceArray);
        }),
        TE.tapIO(res => () => console.log('Upload file result:', res))
      ),
  });
