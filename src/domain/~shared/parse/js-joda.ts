import { DateTimeFormatter, LocalDate, Temporal } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/lib/Either';
import * as O from 'fp-ts/lib/Option';

import { ParseError } from '../error/parse-error';
import { keys } from 'src/~shared/util/types';
import { LocalDateRange } from 'src/domain/models/local-date-range';

type Parser<T extends Temporal> = { parse: (s: string) => T };

const parse =
  <T extends Temporal>(parser: Parser<T>) =>
  (s: string) =>
    E.tryCatch(
      () => parser.parse(s),
      e => new ParseError((e as Error)?.message)
    );

const parseOption =
  <T extends Temporal>(parser: Parser<T>) =>
  (s: string | undefined | null) =>
    pipe(s, O.fromNullable, O.traverse(E.Applicative)(parse(parser)));

export default {
  parse,
  parseOption,
};
