import { LocalDate } from '@js-joda/core';
import Immutable, { List, Record } from 'immutable';
import { LocalDateRange } from '../../../../../src/domain/models/local-date-range';
import { WorkedHoursResume } from '../../../../../src/domain/models/time-card-computation/timecard/worked-hours-rate';
import { WorkingPeriodTimecard } from '../../../../../src/domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../../../../src/domain/models/time-card-computation/working-period/working-period';
import { ClassAttributes } from '../../../../../src/~shared/util/types';
import { contracts } from '../../../../application/timecard-computation/computeTimecardHelper';

describe('WorkingPeriodTimecard', () => {
  let workingPeriodTimecard: WorkingPeriodTimecard;
  const params: ClassAttributes<WorkingPeriodTimecard> = {
    id: '1',
    employee: 'employee1',
    contractId: 'contract1',
    workingPeriod: WorkingPeriod.build({
      employeeId: 'employeeId',
      employmentContractId: '1',
      period: new LocalDateRange(LocalDate.of(2023, 1, 3), LocalDate.of(2023, 1, 9)),
    }),
    workedHours: new WorkedHoursResume(),
    fakeShifts: List(),
  };

  beforeEach(() => {
    workingPeriodTimecard = WorkingPeriodTimecard.build(params);
  });

  it('should build a new WorkingPeriodTimecard', () => {
    expect(workingPeriodTimecard).toBeInstanceOf(WorkingPeriodTimecard);
  });

  it('should generate fake shifts', () => {
    const contract = contracts.OneWeekContract;
    const fakeShifts = workingPeriodTimecard.generateFakeShifts(contract);
    expect(fakeShifts).toBeInstanceOf(List);
  });

  it('should compare equality with another WorkingPeriodTimecard', () => {
    const anotherWorkingPeriodTimecard = WorkingPeriodTimecard.build(params);
    expect(workingPeriodTimecard.equals(anotherWorkingPeriodTimecard)).toBe(true);
  });

  describe('.generateFakeShifts', () => {
    it('should generate 2 fake shifts for Monday', () => {
      const contract = contracts.OneWeekContract;
      const fakeShifts = workingPeriodTimecard.generateFakeShifts(contract);
      console.log(fakeShifts.toJSON())
      expect(fakeShifts.size).toBe(2);
    });
    it('should not generate fake shifts', () => {
      const contract = contracts.OneWeekContract;
      const fakeShifts = workingPeriodTimecard
        .with({
          workingPeriod: workingPeriodTimecard.workingPeriod.with({
            period: workingPeriodTimecard.workingPeriod.period.with({ start: LocalDate.of(2023, 1, 2) }),
          }),
        })
        .generateFakeShifts(contract);
      expect(fakeShifts.size).toBe(0);
    });
  });
});