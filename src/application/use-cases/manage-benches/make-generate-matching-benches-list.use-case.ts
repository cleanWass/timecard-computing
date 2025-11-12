import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { manageBenchAffectationService } from '../../../domain/services/bench-management/generate-bench-affectations.service';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';
import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeGenerateMatchingBenchesListUseCase = {
  execute: (params: { period: LocalDateRange }) => TE.TaskEither<Error, string>;
};

export const makeGenerateMatchingBenchesListUseCase = (
  careDataParserClient: CareDataParserClient
): MakeGenerateMatchingBenchesListUseCase => ({
  execute: ({ period }) =>
    pipe(
      TE.Do,
      TE.bind('benchedEmployees', () =>
        careDataParserClient.getEmployeesWithBenchGeneration(period)
      ),
      TE.bind('benchedTimecards', ({ benchedEmployees }) =>
        pipe(
          benchedEmployees,
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
      TE.map(({ weeks, benchedTimecards, activeTimecards }) =>
        manageBenchAffectationService.computeMatchingAffectationsList({
          weeks,
          benchedEmployeesTimecard: benchedTimecards,
          activeEmployeesTimecard: activeTimecards,
        })
      )
    ),
});
