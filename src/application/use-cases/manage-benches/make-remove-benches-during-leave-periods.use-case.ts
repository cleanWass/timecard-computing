import { flow, identity, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { Bench } from '../../../domain/models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { manageBenchesService } from '../../../domain/services/bench-management/bench-management.service';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';

import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeRemoveExtraBenchesUseCase = {
  execute: ({
    period,
  }: {
    period: LocalDateRange;
  }) => TE.TaskEither<Error, readonly { employee: Employee; benches: Set<Bench> }[]>;
};

export const makeRemoveBenchesDuringLeavePeriodsUseCase = (
  careDataParserClient: CareDataParserClient
): MakeRemoveExtraBenchesUseCase => ({
  execute: ({ period }) =>
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
      TE.bind('extraBenches', ({ timecardComputationResultForPeriod }) =>
        TE.right(
          manageBenchesService.removeBenchesDuringLeavePeriods(timecardComputationResultForPeriod)
        )
      ),
      TE.bind('benchAffectationsToDelete', ({ extraBenches }) =>
        pipe(
          extraBenches,
          TE.traverseArray(({ benches, employee }) =>
            careDataParserClient.deleteBenchAffectations({
              affectationsIds: benches.map(b => b.getAffectationId()).toArray(),
              silaeId: employee.silaeId,
            })
          )
        )
      ),
      TE.tapIO(
        ({ extraBenches }) =>
          () =>
            console.log(
              extraBenches.flatMap(({ benches }) => benches.toArray()).map(b => b.debug())
            )
      ),
      TE.map(({ extraBenches }) => identity(extraBenches))
    ),
});
