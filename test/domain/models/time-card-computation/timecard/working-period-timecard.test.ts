import { LocalDate } from '@js-joda/core';
import { List, Map } from 'immutable';
import { Employee } from '../../../../../src/domain/models/employee-registration/employee/employee';
import { LocalDateRange } from '../../../../../src/domain/models/local-date-range';
import { WorkedHoursRecap } from '../../../../../src/domain/models/cost-efficiency/worked-hours-rate';
import { WorkingPeriodTimecard } from '../../../../../src/domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../../../../src/domain/models/time-card-computation/working-period/working-period';
import { ClassAttributes } from '../../../../../src/~shared/util/types';
import { contracts } from '../../../../application/timecard-computation/computeTimecardHelper';

const employee1 = Employee.build({
  id: '1',
  firstName: 'Wass',
  lastName: 'Krif',
  seniorityDate: LocalDate.of(2022, 1, 1),
  role: 'Admin',
  silaeId: '10',
});

describe('WorkingPeriodTimecard', () => {
  let workingPeriodTimecard: WorkingPeriodTimecard;
  const params: ClassAttributes<WorkingPeriodTimecard> = {
    id: '1',
    employee: employee1,
    contract: contracts.OneWeekContract,
    workingPeriod: WorkingPeriod.build({
      employeeId: 'employeeId',
      employmentContractId: '1',
      period: new LocalDateRange(LocalDate.of(2023, 1, 3), LocalDate.of(2023, 1, 9)),
    }),
    workedHours: new WorkedHoursRecap(),
    weeklyPlanning: Map(),
    inactiveShifts: List(),
    shifts: List(),
    leaves: List(),
    mealTickets: 0,
  };

  beforeEach(() => {
    workingPeriodTimecard = WorkingPeriodTimecard.build(params);
  });

  it('should build a new WorkingPeriodTimecard', () => {
    expect(workingPeriodTimecard).toBeInstanceOf(WorkingPeriodTimecard);
  });

  it('should compare equality with another WorkingPeriodTimecard', () => {
    const anotherWorkingPeriodTimecard = WorkingPeriodTimecard.build(params);
    expect(workingPeriodTimecard.equals(anotherWorkingPeriodTimecard)).toBe(true);
  });
});
