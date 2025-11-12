import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List, Set } from 'immutable';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { LeavePeriod } from '../../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { manageBenchAffectationService } from '../../../domain/services/bench-management/generate-bench-affectations.service';
import { BenchGenerationProcessResult } from '../../../domain/services/bench-management/types';
import { generateRequestId, logger } from '../../../~shared/logging/logger';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';

import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type MakeCreateMissingBenchesUseCase = {
  execute: (params: {
    period: LocalDateRange;
  }) => TE.TaskEither<Error, BenchGenerationProcessResult>;
};

export const makeCreateMissingBenchesUseCase = (
  careDataParserClient: CareDataParserClient
): MakeCreateMissingBenchesUseCase => ({
  execute: ({ period }) => {
    const log = logger.child({ request_id: generateRequestId(), use_case: 'manage-intercontract' });
    const startTime = Date.now();

    log.info('Use case started', {
      period: period.toFormattedString(),
    });

    return pipe(
      TE.Do,
      TE.bind('employeesWithBenchGeneration', () =>
        careDataParserClient.getEmployeesWithBenchGeneration(period)
      ),
      TE.chainFirst(({ employeesWithBenchGeneration }) =>
        TE.fromTask(async () => {
          log.info('Employees fetched', {
            count: employeesWithBenchGeneration.length,
            employeesData: employeesWithBenchGeneration,
          });
          return undefined;
        })
      ),
      TE.bind(`timecardComputationResultForPeriod`, ({ employeesWithBenchGeneration }) =>
        pipe(
          employeesWithBenchGeneration,
          TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
        )
      ),
      TE.bind('missingBenches', ({ timecardComputationResultForPeriod }) =>
        manageBenchAffectationService.generateMissingBenches({ period })(
          timecardComputationResultForPeriod
        )
      ),
      TE.bind('benchAffectations', ({ missingBenches }) =>
        pipe(missingBenches, TE.traverseArray(careDataParserClient.generateBenchAffectation))
      ),
      TE.map(({ missingBenches, employeesWithBenchGeneration, benchAffectations }) => ({
        period,
        processedEmployees: employeesWithBenchGeneration.length,
        totalAffectationsCreated: benchAffectations.length,
        details: employeesWithBenchGeneration.map(r => ({
          employee: r.employee,
          affectations: Set(missingBenches.filter(a => a.employee.id === r.employee.id)),
        })),
      }))
    );
  },
});
