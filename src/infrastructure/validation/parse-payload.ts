import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List } from 'immutable';
import { ExtractEitherRightType } from '../../~shared/util/types';
import { employeeDataValidator } from './extern/employee';

export const formatPayload = (data: ExtractEitherRightType<typeof parsePayload>) => {
  return {
    employee: data.employee,
    shifts: List(data.shifts),
    leaves: List(data.leaves),
    contracts: List(data.contracts),
  };
};

export const parsePayload = (payload: unknown) =>
  pipe(
    payload,
    employeeDataValidator.safeParse,
    E.fromPredicate(
      parsedJSON => parsedJSON.success,
      e => {
        let error = new Error(`success : ${e.success} \n Error while parsing payload ${e['error']}`);
        console.log(error);
        return error;
      }
    ),
    E.map(parsedJSON => (parsedJSON.success ? parsedJSON.data : null)),
    E.mapLeft(e => console.log('error while parsing', e)),
    E.map(({ leaves, contracts, shifts, cleaner }) => ({
      shifts,
      leaves,
      contracts,
      employee: cleaner,
    }))
  );
