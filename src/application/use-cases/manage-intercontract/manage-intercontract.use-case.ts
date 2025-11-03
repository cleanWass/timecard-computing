import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { generateSlotToCreatesService } from '../../../domain/services/bench-generation/generate-bench-affectations.service';
import { IntercontractResult } from '../../../domain/services/bench-generation/types';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';

import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

export type ManageIntercontractUseCase = {
  execute: (params: { period: LocalDateRange }) => TE.TaskEither<Error, IntercontractResult>;
};

export const makeManageIntercontractUseCase = (
  careDataParserClient: CareDataParserClient
): ManageIntercontractUseCase => ({
  execute: ({ period }) =>
    pipe(
      careDataParserClient.getIntercontractEmployees(period),
      TE.chainW(TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))),
      TE.chainW(generateSlotToCreatesService.generateIntercontract({ period })),
      TE.map(results => ({
        period,
        processedEmployees: results?.length,
        totalAffectationsCreated: results
          .flatMap(r => r.benchesToCreate)
          .reduce((sum, r) => sum + r.size, 0),
        statistics: results?.map(r => ({
          employee: r.employee,
          stats: generateSlotToCreatesService.computeStatistics(r.benchesToCreate),
        })),
        details: results.map(r => ({
          employee: r.employee,
          affectations: r.benchesToCreate,
        })),
      }))
    ),
});
