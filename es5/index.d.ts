declare const _default: {
    delay: {
        (milliseconds: number): Promise<void>;
        <T>(milliseconds: number, t: T): Promise<T>;
    };
    delayChain: (milliseconds: number) => <T>(t?: T) => Promise<T>;
    finallyDelay: (milliseconds: number) => [<T>(t?: T) => Promise<T>, (err?: any) => any];
    finally: (fn: () => void | PromiseLike<void>) => [<T>(t?: T) => Promise<T>, (err?: any) => any];
    Finally: (fn: () => void | PromiseLike<void>) => [<T>(t?: T) => Promise<T>, (err?: any) => any];
    tap: <T, U, Fn extends (T: any) => void | PromiseLike<void>>(fn: Fn) => (u: U) => Promise<U>;
    props: (obj: any) => Promise<any>;
    filter: {
        <T>(filterFn: MapFn<T, boolean>): (t: (T | PromiseLike<T>)[]) => Promise<T[]>;
        <T>(opts: Partial<ConcurrencyOptions>, filterFn: MapFn<T, boolean>): (t: (T | PromiseLike<T>)[]) => Promise<T[]>;
        <T>(arr: (T | PromiseLike<T>)[], filterFn: MapFn<T, boolean>): Promise<T[]>;
        <T>(arr: (T | PromiseLike<T>)[], opts: Partial<ConcurrencyOptions>, filterFn: MapFn<T, boolean>): Promise<T[]>;
    };
    map: {
        <T, U>(mapFn: MapFn<T, U>): (t: (T | PromiseLike<T>)[]) => Promise<U[]>;
        <T, U>(opts: Partial<ConcurrencyOptions>, mapFn: MapFn<T, U>): (t: (T | PromiseLike<T>)[]) => Promise<U[]>;
        <T, U>(arr: (T | PromiseLike<T>)[], mapFn: MapFn<T, U>): Promise<U[]>;
        <T, U>(arr: (T | PromiseLike<T>)[], opts: Partial<ConcurrencyOptions>, mapFn: MapFn<T, U>): Promise<U[]>;
    };
    defer: <T>() => Deferred<T>;
    Try: <T>(cb: () => T) => Promise<T>;
};
export default _default;
export declare function delay(milliseconds: number): Promise<void>;
export declare function delay<T>(milliseconds: number, t: T): Promise<T>;
export declare function delayChain(milliseconds: number): <T>(t?: T) => Promise<T>;
export declare function finallyDelay(milliseconds: number): FinallyWrapper;
export declare type FinallyWrapper = [<T>(t?: T) => Promise<T>, (err?: any) => any];
export declare function Finally(fn: () => (void | PromiseLike<void>)): FinallyWrapper;
export declare function tap<T, U, Fn extends (T) => (void | PromiseLike<void>)>(fn: Fn): (u: U) => Promise<U>;
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
export interface Deferred<T> {
    resolve: (t: T | PromiseLike<T>) => void;
    reject: <E extends Error>(err: E) => void;
    promise: Promise<T>;
}
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export declare function defer<T>(): Deferred<T>;
export declare function Try<T>(cb: () => T): Promise<T>;
