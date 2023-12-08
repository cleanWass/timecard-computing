import { Duration } from '@js-joda/core';

import * as E from 'fp-ts/Either';
import { Task } from 'fp-ts/es6/Task';
import * as T from 'fp-ts/Task';
import { pipe } from 'fp-ts/function';
import { List, Map } from 'immutable';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/time-card/WorkingPeriodTimecard';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/WorkingPeriod';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import {
  computeSupplementaryHours,
  computeTotalSupplementaryHours,
  divideSupplementaryHoursByRating,
} from './full-time-computation/full-time-computation';
import { computeComplementaryHours } from './partial-time-computation/partial-time-computation';
import type { WPTimecardComputation } from './util/types';
import { groupShiftsByWorkingPeriods, splitPeriodIntoWorkingPeriods } from './util/workingPeriodsComputation';

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

const initializeWorkingPeriodTimecard = (workingPeriod: WorkingPeriod) =>
  WorkingPeriodTimecard.build({
    contractId: workingPeriod.employmentContractId,
    employeeId: workingPeriod.employeeId,
    workingPeriod: workingPeriod,
  });

// todo pattern matching on contract fulltime et flow(a) flow(b) selon temps plein / partiel ?
// [ ] si semaine incomplète (nouveau contrat ou avenant), ajouter aux jours manquants les heures habituels selon le planning
// [ ] faire le total des heures normales disponibles (congés payes + jours fériés) de la semaine
// [ ] faire le total des heures travaillées de la semaine
// [ ] si le total des heures travaillées + heures normales disponibles est > contrat, décompter les heures normales effectives
// [ ] si plus d'heures normales disponibles, décompter des heures sup / comp
// [ ] calculer la majoration des heures additionnelles selon contrat HC10 11 25 | HS 25 50
// [ ] calculer les majorations pour dimanche / jour férié / nuit

const fillIfPartialWeek = (contract: EmploymentContract) => (wpTimecard: WorkingPeriodTimecard) => {
  if (wpTimecard.workingPeriod.isComplete(contract)) return wpTimecard;
  // TODO
  return wpTimecard;
};
export const computeWorkingPeriodTimecard: (
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contract: EmploymentContract
) => WorkingPeriodTimecard = (workingPeriod, shifts, leaves, contract) =>
  pipe(
    workingPeriod,
    initializeWorkingPeriodTimecard,
    fillIfPartialWeek(contract),
    computeTotalHours(shifts),
    computeComplementaryHours(contract),
    computeSupplementaryHours(contract),
    divideSupplementaryHoursByRating(contract)
  );

const formatDuration = (d: Duration) => `${d.toHours()}h${d?.toMinutes() % 60 > 0 ? `${d.toMinutes() % 60} ` : ''}`;

export const computeTimecardForEmployee =
  (period: LocalDateRange) =>
  ({
    employeeId,
    shifts,
    contracts,
    leaves,
  }: {
    employeeId: string;
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
                  contract
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
            employeeId,
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
