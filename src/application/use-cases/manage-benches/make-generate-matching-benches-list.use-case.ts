import { DateTimeFormatter, LocalDateTime } from '@js-joda/core';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { EnvService } from '../../../config/env';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { manageBenchesService } from '../../../domain/services/bench-management/bench-management.service';
import { IllegalArgumentError } from '../../../domain/~shared/error/illegal-argument-error';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';
import { FileStoragePort, UploadFileResult } from '../../ports/services/file-storage-port';
import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeGenerateMatchingBenchesListUseCase = {
  execute: (params: {
    period: LocalDateRange;
  }) => TE.TaskEither<Error | IllegalArgumentError, ReadonlyArray<UploadFileResult>>;
};

export const makeGenerateMatchingBenchesListUseCase =
  (careDataParserClient: CareDataParserClient) =>
  (fileStoragePort: FileStoragePort): MakeGenerateMatchingBenchesListUseCase => ({
    execute: ({ period }) =>
      pipe(
        TE.Do,
        TE.bind('benchedEmployees', () =>
          careDataParserClient.getEmployeesWithBenchGeneration(period)
        ),
        TE.bind('benchedTimecards', ({ benchedEmployees }) =>
          pipe(
            benchedEmployees ?? [],
            TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
          )
        ),
        TE.bind('activeEmployees', ({ benchedEmployees }) =>
          pipe(
            careDataParserClient.getAllActiveEmployeesData(period),
            TE.map(allActive => {
              const benchedIds = Set(benchedEmployees.map(e => e.employee.silaeId));
              return allActive.filter(e => !benchedIds.has(e.employee.silaeId));
            })
          )
        ),
        TE.bind('activeTimecards', ({ activeEmployees }) =>
          pipe(
            activeEmployees,
            TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
          )
        ),
        TE.bind('weeks', () => TE.of(period.divideIntoCalendarWeeks())),
        TE.bind('csvContent', ({ weeks, benchedTimecards, activeTimecards }) =>
          TE.of(
            manageBenchesService.computeMatchingAffectationsList({
              weeks,
              benchedEmployeesTimecard: benchedTimecards,
              activeEmployeesTimecard: activeTimecards,
            })
          )
        ),
        TE.bind(`versioningFileName`, () => {
          const timestamp = LocalDateTime.now().format(
            DateTimeFormatter.ofPattern('yyyy/yyMMddHHmm')
          );
          return TE.of(`matching-benches-list/records/${timestamp}.csv`);
        }),
        TE.bind('mainFileName', () => TE.of('matching-benches-list/matching-benches-list.csv')),
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
        })
      ),
  });
