import * as E from 'fp-ts/Either';
import { Either } from 'fp-ts/Either';
import { z } from 'zod';
import { ValidationError } from '../../../../~shared/error/validation-error';

export const validateWithZod = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): Either<ValidationError, T> => {
  const result = schema.safeParse(data);

  if (result.success) {
    return E.right(result.data);
  }

  return E.left(
    new ValidationError(
      `Validation failed${context ? ` for ${context}` : ''}: ${result.error.issues
        .map(i => i.message)
        .join(', ')} 
      \n${result.error}
        `
    )
  );
};
