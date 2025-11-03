import { Request, Response } from 'express';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { LocalDate } from '@js-joda/core';
import { ManageIntercontractUseCase } from '../../../application/use-cases/manage-intercontract/manage-intercontract.use-case';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { parseLocalDate } from '../../../~shared/util/joda-helper';

export const makeIntercontractController = (
  manageIntercontractUseCase: ManageIntercontractUseCase
) => ({
  generate: async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;

    await pipe(
      TE.of(
        new LocalDateRange(parseLocalDate({ date: startDate }), parseLocalDate({ date: endDate }))
      ),
      TE.chain(period => manageIntercontractUseCase.execute({ period })),
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
});
