import {TaskEither} from 'fp-ts/TaskEither';
import {List} from 'immutable';
import {LocalDate} from '@js-joda/core';

import {PersistenceError} from '@domain/~shared/error/PersistenceError';
import {ExpectedAggregateNotFoundError} from '@domain/~shared/error/ExpectedAggregateNotFoundError';
import {EmployeeId} from '@domain/models/employee-registration/employee/EmployeeId';
import {EmploymentContractId} from './EmploymentContractId';
import {EmploymentContract} from './EmploymentContract';

export interface EmploymentContractRepository {
  find(
    id: EmploymentContractId
  ): TaskEither<ExpectedAggregateNotFoundError, EmploymentContract>;

  lookupByEmployeeIdAndPeriod(
    id: EmployeeId,
    start: LocalDate,
    end: LocalDate
  ): TaskEither<PersistenceError, List<EmploymentContract>>;
}
