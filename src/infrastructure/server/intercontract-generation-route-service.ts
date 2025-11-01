import axios from 'axios';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List } from 'immutable';
import { z } from 'zod';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { ParseError } from '../../~shared/error/ParseError';
import { employeeDataValidator } from '../validation/extern/employee';

export const parseIntercontractGenerationPayload = (data: unknown) =>
  pipe(
    data,
    z.array(employeeDataValidator).safeParse,
    E.fromPredicate(
      parsedJSON => parsedJSON.success && parsedJSON?.data !== null,
      e => {
        console.log(
          `safe parse success : ${e.success} \n Error while parsing payload 2 ${e['error']}`
        );
        return new ParseError(
          `safe parse success : ${e.success} \n  Error while parsing payload 2 ${e['error']}`
        );
      }
    ),
    E.chain(parsedJSON =>
      parsedJSON.success ? E.right(parsedJSON.data) : E.left(new ParseError('data is empty'))
    )
  );

export const formatIntercontractGenerationPayload = (
  data: ReturnType<typeof parseIntercontractGenerationPayload>
) =>
  pipe(
    data,
    E.map(employees =>
      employees.map(({ contracts, employee, leaves, shifts }) => ({
        employee,
        shifts: List(shifts),
        leaves: List(leaves),
        contracts: List(contracts),
      }))
    )
  );

export const fetchIntercontractData = async ({ start, end }: LocalDateRange) => {
  const url = `${process.env.CARE_DATA_PARSER_URL || 'http://localhost:3000'}/intercontract`;
  const r = await axios.post(url, {
    startDate: start,
    endDate: end,
  });
  return r.data;
};
