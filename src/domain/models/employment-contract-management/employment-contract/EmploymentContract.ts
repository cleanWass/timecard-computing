import * as O from 'fp-ts/Option';
import {Set} from 'immutable';
import {DayOfWeek, Duration, LocalDate} from '@js-joda/core';

import {EmployeeId} from '../../employee-registration/agent/EmployeeId';
import {EmploymentContractId} from './EmploymentContractId';

export type EmploymentContract = {
  id: EmploymentContractId;
  cleanerId: EmployeeId;
  startDate: LocalDate;
  endDate: O.Option<LocalDate>;
  weeklyTotalWorkedHours: Duration;
  weeklyNightShiftHours: Duration;
  workedDays: Set<DayOfWeek>;
};
