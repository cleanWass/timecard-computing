import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/lib/function';
import z from 'zod';
import { ParseError } from '../../~shared/error/ParseError';

export const parseWithValidator = <Output, Input = Output>(
  validator: z.ZodType<Output, z.ZodTypeDef, Input>,
  data: unknown
): E.Either<ParseError, Output> => {
  return pipe(
    validator.safeParse(data),
    E.fromPredicate(
      (result): result is z.SafeParseSuccess<Output> => result.success && result.data !== null,
      result => {
        const errorResult = result as z.SafeParseError<Input>;
        console.log(`Parse failed: ${result.success}\nError: ${errorResult.error}`);
        const message = `safe parse success: ${result.success}\nError while parsing payload ${
          !result.success ? (result as z.SafeParseError<Input>).error : 'unknown'
        }`;
        return new ParseError(message);
      }
    ),
    E.map(result => result.data)
  );
};

export const createParser = <TSchema extends z.ZodTypeAny>(validator: TSchema) => {
  type Output = z.output<TSchema>;
  type Input = z.input<TSchema>;

  return {
    parse: (data: unknown) => parseWithValidator<Output, Input>(validator, data),

    parseAndMap: <U>(data: unknown, mapper: (value: Output) => U) =>
      pipe(parseWithValidator<Output, Input>(validator, data), E.map(mapper)),
  };
};
export const formatPayload = <T>(data: T): T => {
  return data;
};
