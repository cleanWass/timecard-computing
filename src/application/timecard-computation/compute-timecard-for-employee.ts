import { DateTimeFormatter, DayOfWeek, Duration, Instant, LocalDateTime, TemporalAdjusters } from '@js-joda/core';

import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { Task } from 'fp-ts/es6/Task';
import * as T from 'fp-ts/Task';
import { Interval } from '@js-joda/extra';
import { identity, pipe } from 'fp-ts/function';
import { List, Map, Set } from 'immutable';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { formatDuration, getFirstDayOfWeek } from '../../~shared/util/joda-helper';
import {
  computeSupplementaryHours,
  computeTotalSupplementaryHours,
  divideSupplementaryHoursByRating,
} from './full-time-computation/full-time-computation';
import { computeComplementaryHours } from './partial-time-computation/partial-time-computation';
import type { WPTimecardComputation } from './util/types';
import { groupShiftsByWorkingPeriods, splitPeriodIntoWorkingPeriods } from './util/working-period-computation';

const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) =>
  E.right(groupedShifts.map(gs => gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)));

// todo HERE
const computeNightShiftHours: WPTimecardComputation = contract => timecard => {
  const nightHours = contract.weeklyNightShiftHours;
  return timecard;
};

const computeTotalHours = (shifts: List<Shift>) => (timecard: WorkingPeriodTimecard) =>
  timecard.register(
    'TotalWeekly',
    shifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
  );

const findContract = (contracts: List<EmploymentContract>) => (workingPeriod: WorkingPeriod) =>
  pipe(
    contracts.find(c => c.id === workingPeriod.employmentContractId),
    E.fromNullable(new TimecardComputationError('Missing contract')),
    E.map(contract => ({ contract, workingPeriod }))
  );

const initializeWorkingPeriodTimecard = ({
  shifts,
  leaves,
  contract,
  workingPeriod,
  employee,
}: {
  shifts: List<Shift>;
  leaves: List<Leave>;
  contract: EmploymentContract;
  employee: Employee;
  workingPeriod: WorkingPeriod;
}) =>
  WorkingPeriodTimecard.build({
    contract,
    employee,
    workingPeriod,
    shifts,
    leaves,
  });

// todo pattern matching on contract fulltime et flow(a) flow(b) selon temps plein / partiel ?
// [x] si semaine incomplète (nouveau contrat ou avenant), ajouter aux jours manquants les heures habituels selon le planning
// [/] faire le total des heures normales disponibles (congés payes + jours fériés) de la semaine
// [ ] faire le total des heures travaillées de la semaine
// [ ] si le total des heures travaillées + heures normales disponibles est > contrat, décompter les heures normales effectives
// [ ] si plus d'heures normales disponibles, décompter des heures sup / comp
// [ ] calculer la majoration des heures additionnelles selon contrat HC10 11 25 | HS 25 50
// [ ] calculer les majorations pour dimanche / jour férié / nuit
// [ ] enlever les heures fictives

// TODO passer en option

const generateFakeShifts = (timecard: WorkingPeriodTimecard) =>
  timecard.workingPeriod.period
    .with({
      start: getFirstDayOfWeek(timecard.workingPeriod.period.start),
      end: getFirstDayOfWeek(timecard.workingPeriod.period.start).plus(timecard.contract.overtimeAveragingPeriod),
    })
    .toLocalDateArray()
    .filter(d => !timecard.workingPeriod.period.contains(d))
    .reduce(
      (shifts, day) =>
        shifts.concat(
          timecard.contract.weeklyPlanning
            .get(day.dayOfWeek(), Set<LocalTimeSlot>())
            .toList()
            .map((timeSlot, index) =>
              Shift.build({
                id: `fake_shift_workingPeriod-${timecard.id}--${index}`,
                duration: timeSlot.duration(),
                employeeId: timecard.employee.id,
                startTime: LocalDateTime.of(day, timeSlot.startTime),
                clientId: 'fake_client',
              })
            )
        ),
      List<Shift>()
    );

const generateFakeShiftsIfPartialWeek = (wpTimecard: WorkingPeriodTimecard) =>
  wpTimecard.workingPeriod.isComplete(wpTimecard.contract) ? wpTimecard : wpTimecard.with({ fakeShifts: generateFakeShifts(wpTimecard) });

const computeTotalNormalHoursAvailable = (leaves: List<Leave>, shifts: List<Shift>) => (timecard: WorkingPeriodTimecard) => {
  const contract = timecard.contract;
  const normalHoursFromLeaves = shifts
    .filter(shift => leaves.some(leave => leave.period.contains(shift.startTime.toLocalDate())))
    .reduce((sum, shift) => sum.plus(shift.duration), Duration.ZERO);

  // TODO compute normal hours from holidays
  const normalHoursFromHolidays = Duration.ZERO;

  return timecard.register('TotalNormalAvailable', normalHoursFromLeaves.plus(normalHoursFromHolidays));
};

const isShiftDuringLeave = (shift: Shift) => (leave: Leave) => leave.getInterval().contains(Instant.from(shift.startTime));

export const getCuratedShifts = (leave: Leave, shift: Shift) => {
  return pipe(
    shift.getInterval(),
    E.fromPredicate(
      s => leave.getInterval().overlaps(s),
      () => List([shift])
    ),
    E.map(sh => {
      if (leave.getInterval().encloses(sh)) return List<Shift>([]);
      const beforeLeave = Interval.of(sh.start(), leave.getInterval().start());
      const afterLeave = Interval.of(leave.getInterval().end(), sh.end());

      return List([
        beforeLeave.toDuration().toMillis() > 0 &&
          shift.with({ id: `${shift.id}-before Leave ${leave.id}`, duration: beforeLeave.toDuration() }),
        afterLeave.toDuration().toMillis() > 0 &&
          shift.with({
            id: `${shift.id}-after Leave ${leave.id}`,
            startTime: LocalDateTime.of(leave.period.end, leave.endTime),
            duration: afterLeave.toDuration(),
          }),
      ]).filter(identity);
    }),
    E.getOrElse(() => List([shift]))
  );
};

const filterShifts = ({
  workingPeriod,
  contract,
  employee,
  leaves,
  shifts: rawShifts,
}: {
  workingPeriod: WorkingPeriod;
  shifts: List<Shift>;
  leaves: List<Leave>;
  contract: EmploymentContract;
  employee: Employee;
}) => {
  const shifts = rawShifts.flatMap(shift => {
    const leaveDuringShift = leaves.find(isShiftDuringLeave(shift));
    return leaveDuringShift ? getCuratedShifts(leaveDuringShift, shift) : [shift];
  });
  // .filter(shift => leaves.some(leave => leave.period.contains(shift.startTime.toLocalDate())));

  return {
    workingPeriod,
    shifts,
    leaves: leaves.filter(leave => workingPeriod.period.contains(leave.period.start)),
    contract,
    employee,
  };
};

export const computeWorkingPeriodTimecard: (
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contract: EmploymentContract,
  employee: Employee
) => WorkingPeriodTimecard = (workingPeriod, shifts, leaves, contract, employee) => {
  return pipe(
    {
      contract,
      employee,
      workingPeriod,
      shifts,
      leaves,
    },
    filterShifts,
    initializeWorkingPeriodTimecard,
    generateFakeShiftsIfPartialWeek,
    computeTotalNormalHoursAvailable(leaves, shifts),
    computeTotalHours(shifts),
    // filterShifts(shifts),
    computeComplementaryHours(contract),
    computeSupplementaryHours(contract),
    divideSupplementaryHoursByRating(contract)
  );
};

export const computeTimecardForEmployee =
  (period: LocalDateRange) =>
  ({
    employee,
    shifts,
    contracts,
    leaves,
  }: {
    employee: Employee;
    shifts: List<Shift>;
    leaves: List<Leave>;
    contracts: List<EmploymentContract>;
  }) =>
    pipe(
      E.Do,
      E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
      E.bindW('groupedShifts', ({ workingPeriods }) => groupShiftsByWorkingPeriods(shifts, workingPeriods)),
      E.bindW('groupedLeaves', () => E.right(Map<WorkingPeriod, List<Leave>>())),
      E.bindW('totalWeekly', ({ groupedShifts }) => computeTotalHoursByWorkingPeriod(groupedShifts)),
      E.bindW('timecards', ({ workingPeriods, groupedShifts, groupedLeaves }) =>
        pipe(
          workingPeriods.toArray().map(wp =>
            pipe(
              wp,
              findContract(contracts),
              E.map(({ contract, workingPeriod }) =>
                computeWorkingPeriodTimecard(
                  workingPeriod,
                  groupedShifts.get(workingPeriod, List<Shift>()),
                  groupedLeaves.get(workingPeriod, List<Leave>()),
                  contract,
                  employee
                )
              )
            )
          ),
          E.sequenceArray,
          E.map(tcs => List(tcs))
        )
      ),
      E.bindW('totalSupplementaryHours', ({ totalWeekly }) => computeTotalSupplementaryHours(contracts, totalWeekly)),
      E.map(
        ({
          timecards,
          workingPeriods,
          groupedShifts,
          totalWeekly,
          // totalAdditionalHours,
          totalSupplementaryHours,
        }) => {
          console.log(
            timecards
              .map(tc => {
                const contract = contracts.find(c => c.id === tc.workingPeriod.employmentContractId);
                const weekly = tc.workedHours.get('TotalWeekly');
                const complementary = tc.workedHours.get('TotalComplementary');
                const supplementary = tc.workedHours.get('TotalSupplementary');

                return `${tc.workingPeriod.period.toFormattedString()} ${contract?.weeklyTotalWorkedHours.toString()}
                    TotalHours: ${formatDuration(weekly)}
                    TotalComplementary: ${formatDuration(complementary)}
                    TotalSupplementary: ${formatDuration(supplementary)}
                        -- 25%: ${formatDuration(tc.workedHours.TwentyFivePercentRateSupplementary)}
                        -- 50%: ${formatDuration(tc.workedHours.FiftyPercentRateSupplementary)}`;
              })
              .valueSeq()
              .toArray()
              .join('\n')
          );
          return {
            employee,
            period,
            workingPeriods,
            groupedShifts,
            totalWeekly,
            timecards,
            // totalAdditionalHours,
            totalSupplementaryHours,
          };
        }
      )
    );

// TODO
// - [x] filter contracts
// - [x] filter shifts
// - [ ] filter leaves
// - [x] group shifts by contract
// - [ ] group leaves by contract
// - [X] divide contract period into periods
// - [X] match shift and leaves to periods
// - [ ] determiner complement d'heures, heures complementaires, heures supplementaires
// - [ ] ressortir les heures majorées (nuit, dimanche, férié)
// - [ ] calculer les tickets restaurants
// - [ ] computeTimecardForEmployee
