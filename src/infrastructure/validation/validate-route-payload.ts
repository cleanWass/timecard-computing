import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/lib/function';
import zod from 'zod';
import { ParseError } from '../../~shared/error/ParseError';

export const validateRoutePayload =
  <T>(schema: zod.ZodSchema<T>) =>
  (payload: unknown): E.Either<ParseError, T> =>
    pipe(
      schema.safeParse(payload),
      E.fromPredicate(
        (result): result is zod.SafeParseSuccess<T> => result.success,
        error => {
          console.log(error);
          return new ParseError(`Error while parsing payload ${error['error']}`);
        }
      ),
      E.map(result => result.data)
    );
