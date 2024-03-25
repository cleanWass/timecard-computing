import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List } from 'immutable';
import { ParseError } from '../../~shared/error/ParseError';
import { ExtractEitherRightType } from '../../~shared/util/types';
import { employeeDataValidator } from './extern/employee';

export const formatPayload = (data: ExtractEitherRightType<typeof parsePayload>) => {
  return {
    employee: List(data.employee),
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
      parsedJSON => parsedJSON.success && parsedJSON?.data !== null,
      e => {
        console.log(new ParseError(`safe parse success : ${e.success} \n Error while parsing payload ${e['error']} `));
        return new ParseError(`safe parse success : ${e.success} \n Error while parsing payload ${e['error']}`);
      }
    ),
    E.chain(parsedJSON => (parsedJSON.success ? E.right(parsedJSON.data) : E.left(new ParseError('data is empty')))),
    E.map(({ leaves, contracts, shifts, employee }) => ({
      shifts,
      leaves,
      contracts,
      employee,
    }))
  );
