'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const throat = require("throat");
exports.default = {
    delay,
    delayChain,
    finallyDelay,
    finally: Finally,
    Finally,
    tap,
    props,
    filter,
    map,
    reduce,
    defer,
    inspect,
    Try,
    specific,
};
function delay(milliseconds, t) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(t), milliseconds);
    });
}
exports.delay = delay;
function delayChain(milliseconds) {
    return tap(() => delay(milliseconds));
}
exports.delayChain = delayChain;
function finallyDelay(milliseconds) {
    return Finally(() => delay(milliseconds));
}
exports.finallyDelay = finallyDelay;
function Finally(fn) {
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
exports.Finally = Finally;
function tap(fn) {
    return async function (t) {
        await fn(t);
        return t;
    };
}
exports.tap = tap;
function props(obj) {
    const ret = {};
    const awaiters = [];
    for (let prop of Object.keys(obj))
        awaiters.push(Promise.resolve(obj[prop])
            .then(val => { ret[prop] = val; }));
    return Promise.all(awaiters).then(() => ret);
}
exports.props = props;
const defaultFilterMapOptions = { concurrency: Infinity };
function filter(arr, opts, filterFn) {
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
exports.filter = filter;
function map(arr, opts, mapFn) {
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
exports.map = map;
function reduce(input, reducer, initialValue) {
    if (typeof input === 'function') {
        initialValue = reducer;
        const _reducer = input;
        return async function (input) {
            return reduceImpl(input, _reducer, initialValue);
        };
    }
    return reduceImpl(input, reducer, initialValue);
}
exports.reduce = reduce;
async function reduceImpl(input, reducer, initialValue) {
    const _input = Array.from(await input);
    const _initialValue = await initialValue;
    if (_input.length === 0)
        return _initialValue;
    const usingInitialValue = typeof _initialValue !== 'undefined';
    const length = _input.length;
    let index = usingInitialValue ? 0 : 1;
    let accumulator = usingInitialValue
        ? _initialValue
        : await _input.shift();
    while (_input.length > 0)
        accumulator = await reducer(accumulator, await _input.shift(), index++, length);
    return accumulator;
}
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
function defer() {
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
}
exports.defer = defer;
function inspect(promise) {
    const inspectable = {
        promise: null,
        isResolved: false,
        isRejected: false,
        isPending: true,
    };
    inspectable.promise = promise.then(value => {
        inspectable.isResolved = true;
        inspectable.isPending = false;
        return value;
    })
        .catch(err => {
        inspectable.isRejected = true;
        inspectable.isPending = false;
        return Promise.reject(err);
    });
    return inspectable;
}
exports.inspect = inspect;
async function Try(cb) {
    return cb();
}
exports.Try = Try;
// This logic is taken from Bluebird
function catchFilter(filters, err) {
    return (Array.isArray(filters) ? filters : [filters])
        .some((filter) => {
        if (filter == null)
            return false;
        if (filter === Error ||
            filter.prototype instanceof Error) {
            if (err instanceof filter)
                return true;
        }
        else if (typeof filter === "function") {
            const filterFn = filter;
            // It is "ok" for this to throw. It'll be thrown back to the catch
            // handler, and the promise chain will contain this error.
            return filterFn(err);
        }
        else if (typeof filter === "object") {
            const obj = filter;
            for (const key of Object.keys(obj))
                if (obj[key] != err[key])
                    return false;
            return true;
        }
    });
}
function specific(filters, handler) {
    return function (err) {
        if (!catchFilter(filters, err))
            throw err;
        return handler(err);
    };
}
exports.specific = specific;
//# sourceMappingURL=index.js.map