import {EmploymentContractId} from './EmploymentContractId';
import {TaskEither} from 'fp-ts/TaskEither';
import {EmploymentContract} from './EmploymentContract';
import {EmployeeId} from '../../employee-registration/employee/EmployeeId';
import {PersistenceError} from '../../../~shared/error/PersistenceError';
import {ExpectedAggregateNotFoundError} from '../../../~shared/error/ExpectedAggregateNotFoundError';
import {LocalDate} from '@js-joda/core';
import {List} from 'immutable';

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
