import * as E from 'fp-ts/Either';

export default <L, R>(eit: E.Either<L, R>) => (eit as E.Right<R>).right;
