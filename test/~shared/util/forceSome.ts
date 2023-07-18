import * as O from 'fp-ts/Option';

export default <T>(opt: O.Option<T>) => (opt as O.Some<T>).value;
