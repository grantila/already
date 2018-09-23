declare const _default: {
    delay: typeof delay;
    delayChain: typeof delayChain;
    finallyDelay: typeof finallyDelay;
    finally: typeof Finally;
    Finally: typeof Finally;
    tap: typeof tap;
    props: typeof props;
    filter: typeof filter;
    map: typeof map;
    reduce: typeof reduce;
    each: typeof each;
    some: typeof some;
    defer: typeof defer;
    inspect: typeof inspect;
    Try: typeof Try;
    specific: typeof specific;
    rethrow: typeof rethrow;
};
export default _default;
export declare function delay(milliseconds: number): Promise<void>;
export declare function delay<T>(milliseconds: number, t: T): Promise<T>;
export declare function delayChain(milliseconds: number): <T>(t?: T) => Promise<T>;
export declare function finallyDelay(milliseconds: number): FinallyWrapper;
export declare type FinallyWrapper = [<T>(t?: T) => Promise<T>, (err?: any) => any];
export declare function Finally(fn: () => (void | PromiseLike<void>)): FinallyWrapper;
export declare function tap<T, U, Fn extends (T: any) => (void | PromiseLike<void>)>(fn: Fn): (u: U) => Promise<U>;
export declare function props(obj: any): Promise<any>;
export interface ConcurrencyOptions {
    concurrency: number;
}
export declare type FilterMapOptions = Partial<ConcurrencyOptions>;
export declare type MapFn<T, U> = (t: T, index: number, arr: Array<T | PromiseLike<T>>) => U | Promise<U>;
export declare type FilterFn<T> = MapFn<T, boolean>;
export declare function filter<T>(filterFn: FilterFn<T>): (t: Array<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare function filter<T>(opts: FilterMapOptions, filterFn: FilterFn<T>): (t: Array<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare function filter<T>(arr: Array<T | PromiseLike<T>>, filterFn: FilterFn<T>): Promise<Array<T>>;
export declare function filter<T>(arr: Array<T | PromiseLike<T>>, opts: FilterMapOptions, filterFn: FilterFn<T>): Promise<Array<T>>;
export declare function map<T, U>(mapFn: MapFn<T, U>): (t: Array<T | PromiseLike<T>>) => Promise<Array<U>>;
export declare function map<T, U>(opts: FilterMapOptions, mapFn: MapFn<T, U>): (t: Array<T | PromiseLike<T>>) => Promise<Array<U>>;
export declare function map<T, U>(arr: Array<T | PromiseLike<T>>, mapFn: MapFn<T, U>): Promise<Array<U>>;
export declare function map<T, U>(arr: Array<T | PromiseLike<T>>, opts: FilterMapOptions, mapFn: MapFn<T, U>): Promise<Array<U>>;
export declare type SyncReduceInput<T> = Iterable<T | PromiseLike<T>>;
export declare type ReduceInput<T> = SyncReduceInput<T> | PromiseLike<SyncReduceInput<T>>;
export declare type ReduceFunction<T, R> = (accumulator: R, current: T, index: number, length: number) => R | PromiseLike<R>;
export declare function reduce<T>(input: ReduceInput<T>, reducer: ReduceFunction<T, T>): Promise<T | undefined>;
export declare function reduce<T, R>(input: ReduceInput<T>, reducer: ReduceFunction<T, R>, initialValue: R | PromiseLike<R>): Promise<R | undefined>;
export declare function reduce<T>(reducer: ReduceFunction<T, T>): <U extends SyncReduceInput<T>>(input: U) => Promise<T | undefined>;
export declare function reduce<T, R>(reducer: ReduceFunction<T, R>, initialValue: R | PromiseLike<R>): <U extends SyncReduceInput<T>>(input: U) => Promise<R | undefined>;
export declare type EachFn<T> = (t: T, index: number, length: number) => void | Promise<void>;
export declare function each<T>(eachFn: EachFn<T>): (t: ReadonlyArray<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare function each<T>(arr: ReadonlyArray<T | PromiseLike<T>>, eachFn: EachFn<T>): Promise<Array<T>>;
export declare function eachImpl<T>(eachFn: EachFn<T>): ((t: ReadonlyArray<T | PromiseLike<T>>) => Promise<Array<T>>);
export declare type SomeReturn<R> = Promise<R | false>;
export declare type SomeSyncReturn<R> = SomeReturn<R> | R | false;
export declare type SomePredicate<T, R> = (T: any) => SomeSyncReturn<R>;
export declare type SomeArray<T> = ReadonlyArray<T | PromiseLike<T>> | PromiseLike<ReadonlyArray<T | PromiseLike<T>>>;
export declare function some<T, R>(list: SomeArray<T>, fn: SomePredicate<T, R>): SomeReturn<R>;
export declare function some<T, R>(fn: SomePredicate<T, R>): (list: SomeArray<T>) => SomeReturn<R>;
export interface Deferred<T> {
    resolve: (t: T | PromiseLike<T>) => void;
    reject: <E extends Error>(err: E) => void;
    promise: Promise<T>;
}
export interface EmptyDeferred {
    resolve: ((t: void | PromiseLike<void>) => void) & (() => void);
    reject: <E extends Error>(err: E) => void;
    promise: Promise<void>;
}
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export declare function defer<T>(): Deferred<T>;
export declare function defer(v: void): EmptyDeferred;
export interface ResolvedReflection<T> {
    error?: void;
    value: T;
    isResolved: true;
    isRejected: false;
}
export interface RejectedReflection {
    error: Error;
    value?: void;
    isResolved: false;
    isRejected: true;
}
export declare type Reflection<T> = ResolvedReflection<T> | RejectedReflection;
export declare function reflect<T>(promise: Promise<T>): Promise<Reflection<T>>;
export interface InspectablePromise<T> {
    promise: Promise<T>;
    isResolved: boolean;
    isRejected: boolean;
    isPending: boolean;
}
export declare function inspect<T>(promise: Promise<T>): InspectablePromise<T>;
export declare function Try<T>(cb: () => T): Promise<T>;
export declare type ErrorFilterFunction = (err: Error) => boolean;
export declare type ErrorFilterObject = {
    [key: string]: any;
};
export declare type CatchFilter = ErrorConstructor | ErrorFilterFunction | ErrorFilterObject;
export declare function specific<T, U extends Promise<T>>(filters: CatchFilter | Array<CatchFilter>, handler: (err: Error) => U): (err: Error) => (U);
export declare function specific<T>(filters: CatchFilter | Array<CatchFilter>, handler: (err: Error) => T): (err: Error) => (T | Promise<T>);
export declare function rethrow<T extends Error = any>(fn: (err?: T) => (void | PromiseLike<void>)): (err: T) => Promise<never>;
export declare function wrapFunction<R extends void>(wrap: () => () => R): <U, V extends Promise<U> | U>(cb: () => V) => V;
export declare function wrapFunction<T extends {}, R extends void>(wrap: (t: T) => () => R): <U, V extends Promise<U> | U>(t: T, cb: () => V) => V;
export declare function wrapFunction<R extends void>(wrap: () => Promise<() => R>): <U, V extends Promise<U> | U>(cb: () => V) => Promise<U>;
export declare function wrapFunction<T, R extends void>(wrap: (t: T) => Promise<() => R>): <U, V extends Promise<U> | U>(t: T, cb: () => V) => Promise<U>;
export declare function wrapFunction<R extends Promise<void>>(wrap: () => () => R): <U, V extends Promise<U> | U>(cb: () => V) => Promise<U>;
export declare function wrapFunction<T, R extends Promise<void>>(wrap: (t: T) => () => R): <U, V extends Promise<U> | U>(t: T, cb: () => V) => Promise<U>;
export declare function wrapFunction<R extends Promise<void>>(wrap: () => Promise<() => R>): <U, V extends Promise<U> | U>(cb: () => V) => Promise<U>;
export declare function wrapFunction<T, R extends Promise<void>>(wrap: (t: T) => Promise<() => R>): <U, V extends Promise<U> | U>(t: T, cb: () => V) => Promise<U>;
