export const arrayToObject = <const T extends readonly string[], V = unknown>(
  arr: T,
  valueFn?: (key: T[number], index: number) => V
): Record<T[number], V> => {
  const obj = {} as Record<T[number], V>;
  arr.forEach((key, index) => {
    (obj as any)[key] = valueFn ? valueFn(key, index) : undefined;
  });
  return obj;
};
