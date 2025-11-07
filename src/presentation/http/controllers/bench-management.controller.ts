import { Request, Response } from 'express';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { BenchManagementUseCases } from '../../../application/use-cases/manage-benches';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { parseLocalDate } from '../../../~shared/util/joda-helper';

export const makeBenchManagementController = (
  benchManagementUseCases: BenchManagementUseCases
) => ({
  generate: async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;

    await pipe(
      TE.fromEither(
        LocalDateRange.of(parseLocalDate({ date: startDate }), parseLocalDate({ date: endDate }))
      ),
      TE.chain(period => benchManagementUseCases.benchGenerationUseCase.execute({ period })),
      TE.fold(
        error => {
          console.error('[Intercontract Controller] Error:', error);
          return TE.of(
            res.status(500).json({
              error: error.message,
              type: error.name,
            })
          );
        },
        result =>
          TE.of(
            res.status(200).json({
              success: true,
              period: result.period.toFormattedString(),
              processedEmployees: result.processedEmployees,
              affectationsCreated: result.totalAffectationsCreated,
            })
          )
      )
    )();
  },

  clean: async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;

    await pipe(
      TE.of(
        new LocalDateRange(parseLocalDate({ date: startDate }), parseLocalDate({ date: endDate }))
      ),
      TE.chain(period => benchManagementUseCases.benchSuppressionUseCase.execute({ period })),
      TE.fold(
        error => {
          console.error('[Intercontract Controller] Error:', error);
          return TE.of(
            res.status(500).json({
              error: error.message,
              type: error.name,
            })
          );
        },
        results =>
          TE.of(
            res.status(200).json({
              success: true,
              results,
            })
          )
      )
    )();
  },
});
