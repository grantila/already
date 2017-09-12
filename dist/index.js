'use strict';
import * as throat from 'throat';
export default {
    delay,
    delayChain,
    finallyDelay,
    finally: Finally,
    Finally,
    tap,
    props,
    filter,
    map,
    defer,
};
export function delay(milliseconds, t) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(t), milliseconds);
    });
}
export function delayChain(milliseconds) {
    return tap(() => delay(milliseconds));
}
export function finallyDelay(milliseconds) {
    return Finally(() => delay(milliseconds));
}
export function Finally(fn) {
    async function _then(t) {
        await fn();
        return t;
    }
    async function _catch(err) {
        await fn();
        throw err;
    }
    return [_then, _catch];
}
export function tap(fn) {
    return async function (t) {
        await fn(t);
        return t;
    };
}
export function props(obj) {
    const ret = {};
    const awaiters = [];
    for (let prop of Object.keys(obj))
        awaiters.push(Promise.resolve(obj[prop])
            .then(val => { ret[prop] = val; }));
    return Promise.all(awaiters).then(() => ret);
}
const defaultFilterMapOptions = { concurrency: Infinity };
export function filter(arr, opts, filterFn) {
    if (Array.isArray(arr)) {
        if (typeof opts === 'function') {
            filterFn = opts;
            opts = defaultFilterMapOptions;
        }
        return filter(opts, filterFn)(arr);
    }
    if (typeof arr === 'function') {
        filterFn = arr;
        opts = defaultFilterMapOptions;
    }
    else {
        filterFn = opts;
        opts = arr;
    }
    const wrappedFilterFn = (val, index, arr) => Promise.resolve(filterFn(val, index, arr))
        .then(ok => ({ ok, val }));
    return function (t) {
        return map(opts, wrappedFilterFn)(t)
            .then(values => values
            .filter(({ ok }) => ok)
            .map(({ val }) => val));
    };
}
export function map(arr, opts, mapFn) {
    if (Array.isArray(arr)) {
        if (typeof opts === 'function') {
            mapFn = opts;
            opts = defaultFilterMapOptions;
        }
        return map(opts, mapFn)(arr);
    }
    if (typeof arr === 'function') {
        mapFn = arr;
        opts = defaultFilterMapOptions;
    }
    else {
        mapFn = opts;
        opts = arr;
    }
    const { concurrency = Infinity } = opts;
    const promiseMapFn = (t, index, arr) => Promise.resolve(mapFn(t, index, arr));
    const throated = throat(concurrency);
    return function (t) {
        return Promise.resolve(t)
            .then((values) => values.map((val, index, arr) => throated(() => Promise.resolve(val))
            .then((val) => throated(() => promiseMapFn(val, index, arr)))))
            .then(values => Promise.all(values));
    };
}
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export function defer() {
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
}
//# sourceMappingURL=index.js.map