// packages/shared-types/src/infer-utils.ts

// Інферить тип елемента масиву
export type ElementOf<T extends readonly unknown[]> =
  T extends readonly (infer E)[] ? E : never;

// Інферить return type методу об'єкта
// infer R тут витягує повернений тип конкретного методу
export type MethodReturn<T, K extends keyof T> =
  T[K] extends (...args: never[]) => infer R ? R : never;

// Deep Readonly — рекурсивно робить всі поля readonly
export type DeepReadonly<T> =
  T extends (infer E)[]
    ? ReadonlyArray<DeepReadonly<E>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

// Виключає undefined/null із усіх полів
export type StrictRequired<T> = {
  [K in keyof T]-?: NonNullable<T[K]>
};

// Інферить ключі об'єкта де value extends V
export type KeysWhereValue<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T];

// Template literal path builder
// infer тут не потрібен — це generative type
export type ApiPath<
  Prefix extends string,
  Resource extends string,
  Suffix extends string = '',
> = `${Prefix}/${Resource}${Suffix extends '' ? '' : `/${Suffix}`}`;

// Інферить discriminant value з union по ключу
// infer V тут витягує тип поля K з кожного member union
export type DiscriminantOf<T, K extends keyof T> =
  T extends { [P in K]: infer V } ? V : never;

// Інферить тип після Awaited (вбудований в TS 4.5+, залишаємо для сумісності)
export type UnwrapPromise<T> = T extends Promise<infer R> ? UnwrapPromise<R> : T;

// Витягує тип із Record за ключем
export type ValueOf<T> = T[keyof T];

// Перетворює union в intersection
// infer використовується двічі: в contravariant і covariant позиціях
export type UnionToIntersection<U> =
  (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

// Інферить останній елемент tuple
export type LastOf<T extends readonly unknown[]> =
  T extends readonly [...infer _, infer Last] ? Last : never;

// Перевіряє чи є тип strict equal (не просто extends)
export type IsExact<T, U> =
  [T] extends [U] ? ([U] extends [T] ? true : false) : false;