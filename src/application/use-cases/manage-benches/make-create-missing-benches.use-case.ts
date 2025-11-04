import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { generateSlotToCreatesService } from '../../../domain/services/bench-generation/generate-bench-affectations.service';
import { IntercontractResult } from '../../../domain/services/bench-generation/types';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';

import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeCreateMissingBenchesUseCase = {
  execute: (params: { period: LocalDateRange }) => TE.TaskEither<Error, IntercontractResult>;
};

export const makeCreateMissingBenchesUseCase = (
  careDataParserClient: CareDataParserClient
): MakeCreateMissingBenchesUseCase => ({
  execute: ({ period }) =>
    pipe(
      TE.Do,
      TE.bind('employeesWithBenchGeneration', () =>
        careDataParserClient.getEmployeesWithBenchGeneration(period)
      ),
      TE.bind(`timecardComputationResultForPeriod`, ({ employeesWithBenchGeneration }) =>
        pipe(
          employeesWithBenchGeneration,
          TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
        )
      ),
      TE.bind('missingBenches', ({ timecardComputationResultForPeriod }) =>
        generateSlotToCreatesService.generateMissingBenches({ period })(
          timecardComputationResultForPeriod
        )
      ),
      TE.bind(
        'benchAffectations',
        ({ employeesWithBenchGeneration, missingBenches, timecardComputationResultForPeriod }) =>
          pipe(missingBenches, TE.traverseArray(careDataParserClient.generateBenchAffectation))
      ),
      TE.map(
        ({
          missingBenches,
          timecardComputationResultForPeriod,
          employeesWithBenchGeneration,
          benchAffectations,
        }) => ({
          period,
          processedEmployees: employeesWithBenchGeneration.length,
          totalAffectationsCreated: benchAffectations.length,
          details: employeesWithBenchGeneration.map(r => ({
            employee: r.employee,
            affectations: Set(missingBenches.filter(a => a.employee.id === r.employee.id)),
          })),
        })
      )
    ),
});
