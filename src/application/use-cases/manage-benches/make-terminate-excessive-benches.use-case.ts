import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { Bench } from '../../../domain/models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { generateSlotToCreatesService } from '../../../domain/services/bench-generation/generate-bench-affectations.service';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';

import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeTerminateExcessiveBenchesUseCase = {
  execute: (
    period: LocalDateRange
  ) => TE.TaskEither<
    Error,
    readonly { employee: Employee; weeksToReset: LocalDateRange[]; benches: Set<Bench> }[]
  >;
};

export const makeTerminateExcessiveBenchesUseCase = (
  careDataParserClient: CareDataParserClient
): MakeTerminateExcessiveBenchesUseCase => ({
  execute: period =>
    pipe(
      TE.Do,
      TE.bind('employeesWithBenchGeneration', () =>
        careDataParserClient.getEmployeesWithBenchGeneration(period)
      ),
      TE.bind('timecardComputationResultForPeriod', ({ employeesWithBenchGeneration }) =>
        pipe(
          employeesWithBenchGeneration,
          TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
        )
      ),
      TE.bind('excessiveBenches', ({ timecardComputationResultForPeriod }) =>
        generateSlotToCreatesService.terminateExcessiveBenches(timecardComputationResultForPeriod)
      ),
      TE.bind('benchAffectationsToDelete', ({ excessiveBenches }) =>
        pipe(
          excessiveBenches,
          TE.traverseArray(employeeData =>
            careDataParserClient.deleteBenchAffectations({
              affectationsIds: employeeData.benches.map(b => b.getAffectationId()).toArray(),
              silaeId: employeeData.employee.silaeId,
            })
          )
        )
      ),
      TE.map(({ excessiveBenches }) =>
        excessiveBenches.map(({ employee, weeksToReset, benches }) => ({
          employee,
          weeksToReset,
          benches: Set(benches),
        }))
      )
    ),
});
