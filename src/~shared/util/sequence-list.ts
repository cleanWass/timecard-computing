import { Either, left, right, isLeft } from 'fp-ts/Either';
import { List } from 'immutable';

export const sequenceList = <E, A>(list: List<Either<E, A>>): Either<E, List<A>> => {
  let result: List<A> = List();

  for (const either of list) {
    if (isLeft(either)) {
      return left(either.left);
    } else {
      result = result.push(either.right);
    }
  }
  return right(result);
};
