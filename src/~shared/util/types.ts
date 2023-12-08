import {Either} from 'fp-ts/Either';

export const keys = Object.keys as <T>(
  obj: T
) => (keyof T extends infer U ? (U extends string ? U : U extends number ? `${U}` : never) : never)[];

export type ExtractEitherRightType<A extends (...args: unknown[]) => unknown> = ReturnType<A> extends Either<
  any,
  infer B
>
  ? B
  : never;
