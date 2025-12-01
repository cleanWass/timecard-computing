import { LocalDate } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import cron from 'node-cron';
import { BenchManagementUseCases } from '../../application/use-cases/manage-benches/manage-benches.use-case';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { AppDependencies } from '../../presentation/http/app';
import { generateRequestId, logger } from '../../~shared/logging/logger';
import { getFirstDayOfWeek } from '../../~shared/util/joda-helper';

export const makeCreateMissingBenchesScheduler = ({
  benchManagementUseCases,
  config,
  dependencies: { s3Service },
}: {
  dependencies: AppDependencies;
  benchManagementUseCases: BenchManagementUseCases;
  config: {
    enabled: boolean;
    schedule: string;
  };
}) => {
  const log = logger.child({
    request_id: generateRequestId(),
    scheduler: 'Bench Management Scheduler',
  });

  const runJob = async () => {
    const today = LocalDate.now();
    const period = new LocalDateRange(
      getFirstDayOfWeek(today),
      getFirstDayOfWeek(today).plusWeeks(8).plusDays(1)
    );

    log.info(
      `[Bench Management Scheduler] Starting job for period: ${period.toFormattedString()}`,
      {
        period: period.toFormattedString(),
      }
    );

    await pipe(
      TE.Do,
      TE.bind('benchesDuringLeavePeriods', () =>
        benchManagementUseCases.makeRemoveBenchesDuringLeavePeriodsUseCase.execute({ period })
      ),
      TE.bind('suppressedBenches', () =>
        benchManagementUseCases.removeExtraBenches.execute({ period })
      ),
      TE.bind('generatedBenches', () =>
        benchManagementUseCases.generateMissingBenches.execute({ period })
      ),
      TE.bind('benchManagementList', () =>
        benchManagementUseCases
          .makeGenerateBenchManagementListUseCase(s3Service)
          .execute({ period })
      ),
      TE.fold(
        error => {
          log.error('[Bench Management Scheduler] Error:', { error });
          return TE.of(undefined);
        },
        ({ generatedBenches, suppressedBenches, benchesDuringLeavePeriods }) => {
          log.info('[Bench Management Scheduler] Success:', {
            benchesDuringLeavePeriods: benchesDuringLeavePeriods
              .map(
                benchesRemovedForEmployee =>
                  `${benchesRemovedForEmployee.employee.silaeId} ${benchesRemovedForEmployee.employee.firstName} ${benchesRemovedForEmployee.employee.lastName} ${benchesRemovedForEmployee.benches.size}`
              )
              .join(', '),
            suppressedBenches: suppressedBenches.flatMap(employee => employee.benches.toArray())
              .length,
            processedEmployees: generatedBenches.processedEmployees,
            generatedBenches: generatedBenches.totalAffectationsCreated,
          });
          return TE.of(undefined);
        }
      )
    )();
  };

  return {
    start: () => {
      if (!config.enabled) {
        log.warn('[Bench Management Scheduler] Disabled');
        return;
      }

      log.info('[Bench Management Scheduler] Starting...', {
        schedule: config.schedule,
      });

      cron.schedule(config.schedule, runJob, {
        timezone: 'Europe/Paris',
      });
    },

    runManually: runJob,
  };
};
