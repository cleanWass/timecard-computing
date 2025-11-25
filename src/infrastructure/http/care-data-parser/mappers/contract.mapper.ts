import { DayOfWeek, Duration, LocalDate, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { List, Map, Set } from 'immutable';
import { Employee } from '../../../../domain/models/employee-registration/employee/employee';
import { ContractSubType } from '../../../../domain/models/employment-contract-management/employment-contract/contract-sub-type';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../../domain/models/local-time-slot';
import { ParseError } from '../../../../domain/~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { keys } from '../../../../~shared/util/types';
import { dayValidator } from '../../../validation/extern/temporals';
import { validateWithZod } from '../validation/validators';
import {
  ApiScheduledContract,
  apiScheduledContractSchema,
} from '../validation/scheduled-contract.schema';
import { dayShortcuts } from './helper';

export const mapApiContractsToContracts =
  (employee: Employee) =>
  (data: unknown[]): E.Either<ValidationError | ParseError, EmploymentContract[]> => {
    const validatedResults = data.map(item =>
      validateWithZod(apiScheduledContractSchema, item, 'ScheduledContract')
    );

    const errors = validatedResults.filter(E.isLeft);
    if (errors.length > 0) {
      return E.left(errors[0].left);
    }

    const scheduledContracts = validatedResults.map(
      result => (result as E.Right<ApiScheduledContract>).right
    );

    return pipe(
      E.tryCatch(
        () => {
          const contractPlanningsGroupedByContractId = scheduledContracts.reduce(
            (map, curr) =>
              map.update(
                curr.contract.id,
                List<[ApiScheduledContract['planning'], ApiScheduledContract['period']]>(),
                list => list.push([curr.planning, curr.period])
              ),
            Map<string, List<[ApiScheduledContract['planning'], ApiScheduledContract['period']]>>()
          );

          return contractPlanningsGroupedByContractId
            .keySeq()
            .map(contractId => {
              const scheduledContract = scheduledContracts.find(
                sc => sc.contract.id === contractId
              )!;

              const contract = scheduledContract.contract;
              const planning = scheduledContract.planning;
              const extraDuration = Duration.parse(contract.extraDuration ?? 'PT0M');

              return EmploymentContract.build({
                id: contractId,
                initialId: contract.initialId || 'fake' + contractId.split('-')[0],
                employeeId: employee.silaeId,
                startDate: LocalDate.parse(contract.period.start),
                endDate: O.fromNullable(
                  contract.period.end ? LocalDate.parse(contract.period.end) : null
                ),
                overtimeAveragingPeriod: Duration.ofDays(7),
                weeklyTotalWorkedHours: Duration.parse(contract.weeklyHours),
                workedDays: Set(keys(planning).map(d => DayOfWeek[d])),
                type: contract.type,
                subType: contract.subType as ContractSubType,
                extraDuration:
                  contract.subType === 'complement_heure' ? extraDuration : Duration.ZERO,
                weeklyNightShiftHours: EmploymentContract.nightShiftTimeSlots,
                weeklyPlannings: contractPlanningsGroupedByContractId
                  .get(
                    contractId,
                    List<[ApiScheduledContract['planning'], ApiScheduledContract['period']]>()
                  )
                  .reduce((map, curr) => {
                    const weeklyPlanning = dayValidator.options.reduce((acc, day) => {
                      const slots =
                        curr[0][day]?.map(slot => {
                          const startTime = LocalTime.parse(slot.startTime);
                          return new LocalTimeSlot(
                            startTime,
                            Duration.parse(slot.duration).addTo(startTime)
                          );
                        }) || Set<LocalTimeSlot>();
                      return acc.set(DayOfWeek[day], Set(slots));
                    }, Map<DayOfWeek, Set<LocalTimeSlot>>());

                    return map.set(
                      new LocalDateRange(
                        LocalDate.parse(curr[1].start),
                        LocalDate.parse(curr[1].end)
                      ),
                      weeklyPlanning
                    );
                  }, Map<LocalDateRange, WeeklyPlanning>()),
                contractualPlanning: contract?.metadata?.contractualPlanning
                  ? dayShortcuts.reduce((acc, day, index) => {
                      const slots = contract?.metadata?.contractualPlanning?.[day]?.map(
                        (slot: { start: string; end: string }) => {
                          const startTime = LocalTime.parse(slot.start);
                          const endTime = LocalTime.parse(slot.end);
                          return new LocalTimeSlot(startTime, endTime);
                        }
                      );
                      return acc.set(DayOfWeek.values()[index], Set<LocalTimeSlot>(slots));
                    }, Map<DayOfWeek, Set<LocalTimeSlot>>())
                  : Map<DayOfWeek, Set<LocalTimeSlot>>(
                      dayShortcuts.map((d, index) => [
                        DayOfWeek.values()[index],
                        Set<LocalTimeSlot>(),
                      ])
                    ),
              });
            })
            .toArray();
        },
        error => new ParseError(`Failed to build EmploymentContract domain objects: ${error}`)
      )
    );
  };
