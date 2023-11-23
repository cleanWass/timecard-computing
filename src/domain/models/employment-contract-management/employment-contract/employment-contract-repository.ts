import {TaskEither} from 'fp-ts/TaskEither';
import {List} from 'immutable';
import {LocalDate} from '@js-joda/core';

import {PersistenceError} from '@domain/~shared/error/persistence-error';
import {ExpectedAggregateNotFoundError} from '@domain/~shared/error/expected-aggregate-not-found-error';
import {EmployeeId} from '@domain/models/employee-registration/employee/employee-id';
import {EmploymentContractId} from './employment-contract-id';
import {EmploymentContract} from './employment-contract';

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
