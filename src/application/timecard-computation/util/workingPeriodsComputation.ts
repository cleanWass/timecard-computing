import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {List, Map} from 'immutable';
import {divideIntoPeriods} from './divideIntoPeriods';
import {EmploymentContract} from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import {LocalDateRange} from '../../../domain/models/local-date-range';
import {Shift} from '../../../domain/models/mission-delivery/shift/shift';
import {WorkingPeriod} from '../../../domain/models/time-card-computation/working-period/working-period';
import {TimecardComputationError} from '../../../~shared/error/TimecardComputationError';

export const throwIfNoContract = <T>(list: List<T>) =>
  list.isEmpty() ? E.left(new TimecardComputationError('No contract matches this period')) : E.right(list);

export const filterContractsForPeriod = (period: LocalDateRange) => (contracts: List<EmploymentContract>) =>
  contracts.filter(contract => contract.period(period.end).overlaps(period));


const computeWorkingPeriods = (period: LocalDateRange) => {
  return (contracts: List<EmploymentContract>) => {
    return pipe(
      contracts,
      E.fromPredicate(
        crts => !crts.isEmpty(),
        () => new TimecardComputationError('No contract matches this period')
      ),
      E.map(crts =>
        crts.reduce((wps, crt) => {
          const commonRange = crt.period(period.end).commonRange(period);
          return !!commonRange ? wps.concat(divideIntoPeriods(crt, commonRange.start, commonRange.end)) : wps;
        }, List<WorkingPeriod>())
      )
    );
  };
};


export const splitPeriodIntoWorkingPeriods = (contracts: List<EmploymentContract>, period: LocalDateRange) =>
  pipe(contracts, filterContractsForPeriod(period), throwIfNoContract, E.flatMap(computeWorkingPeriods(period)));

export const groupShiftsByWorkingPeriods = (shifts: List<Shift>, workingPeriods: List<WorkingPeriod>) =>
  pipe(workingPeriods, wp =>
    E.right(
      wp.reduce(
        (groupedShifts, workingPeriod) =>
          groupedShifts.set(
            workingPeriod,
            shifts.filter(({startTime}) => workingPeriod.period.includesDate(startTime.toLocalDate().plusDays(1)))
          ),
        Map<WorkingPeriod, List<Shift>>()
      )
    )
  );
