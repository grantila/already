'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var throat = require("throat");
exports.default = {
    delay: delay,
    delayChain: delayChain,
    finallyDelay: finallyDelay,
    finally: Finally,
    Finally: Finally,
    tap: tap,
    props: props,
    filter: filter,
    map: map,
    reduce: reduce,
    defer: defer,
    inspect: inspect,
    Try: Try,
    specific: specific,
};
function delay(milliseconds, t) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () { return resolve(t); }, milliseconds);
    });
}
exports.delay = delay;
function delayChain(milliseconds) {
    return tap(function () { return delay(milliseconds); });
}
exports.delayChain = delayChain;
function finallyDelay(milliseconds) {
    return Finally(function () { return delay(milliseconds); });
}
exports.finallyDelay = finallyDelay;
function Finally(fn) {
    function _then(t) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fn()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, t];
                }
            });
        });
    }
    function _catch(err) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fn()];
                    case 1:
                        _a.sent();
                        throw err;
                }
            });
        });
    }
    return [_then, _catch];
}
exports.Finally = Finally;
function tap(fn) {
    return function (t) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fn(t)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, t];
                }
            });
        });
    };
}
exports.tap = tap;
function props(obj) {
    var ret = {};
    var awaiters = [];
    var _loop_1 = function (prop) {
        awaiters.push(Promise.resolve(obj[prop])
            .then(function (val) { ret[prop] = val; }));
    };
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var prop = _a[_i];
        _loop_1(prop);
    }
    return Promise.all(awaiters).then(function () { return ret; });
}
exports.props = props;
var defaultFilterMapOptions = { concurrency: Infinity };
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
    var wrappedFilterFn = function (val, index, arr) {
        return Promise.resolve(filterFn(val, index, arr))
            .then(function (ok) { return ({ ok: ok, val: val }); });
    };
    return function (t) {
        return map(opts, wrappedFilterFn)(t)
            .then(function (values) {
            return values
                .filter(function (_a) {
                var ok = _a.ok;
                return ok;
            })
                .map(function (_a) {
                var val = _a.val;
                return val;
            });
        });
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
    var _a = opts.concurrency, concurrency = _a === void 0 ? Infinity : _a;
    var promiseMapFn = function (t, index, arr) {
        return Promise.resolve(mapFn(t, index, arr));
    };
    var throated = throat(concurrency);
    return function (t) {
        return Promise.resolve(t)
            .then(function (values) {
            return values.map(function (val, index, arr) {
                return throated(function () { return Promise.resolve(val); })
                    .then(function (val) {
                    return throated(function () { return promiseMapFn(val, index, arr); });
                });
            });
        })
            .then(function (values) { return Promise.all(values); });
    };
}
exports.map = map;
function reduce(input, reducer, initialValue) {
    if (typeof input === 'function') {
        initialValue = reducer;
        var _reducer_1 = input;
        return function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, reduceImpl(input, _reducer_1, initialValue)];
                });
            });
        };
    }
    return reduceImpl(input, reducer, initialValue);
}
exports.reduce = reduce;
function reduceImpl(input, reducer, initialValue) {
    return __awaiter(this, void 0, void 0, function () {
        var _input, _a, _b, _initialValue, usingInitialValue, length, index, accumulator, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _b = (_a = Array).from;
                    return [4 /*yield*/, input];
                case 1:
                    _input = _b.apply(_a, [_f.sent()]);
                    return [4 /*yield*/, initialValue];
                case 2:
                    _initialValue = _f.sent();
                    if (_input.length === 0)
                        return [2 /*return*/, _initialValue];
                    usingInitialValue = typeof _initialValue !== 'undefined';
                    length = _input.length;
                    index = usingInitialValue ? 0 : 1;
                    if (!usingInitialValue) return [3 /*break*/, 3];
                    _c = _initialValue;
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, _input.shift()];
                case 4:
                    _c = _f.sent();
                    _f.label = 5;
                case 5:
                    accumulator = _c;
                    _f.label = 6;
                case 6:
                    if (!(_input.length > 0)) return [3 /*break*/, 9];
                    _d = reducer;
                    _e = [accumulator];
                    return [4 /*yield*/, _input.shift()];
                case 7: return [4 /*yield*/, _d.apply(void 0, _e.concat([_f.sent(), index++, length]))];
                case 8:
                    accumulator = _f.sent();
                    return [3 /*break*/, 6];
                case 9: return [2 /*return*/, accumulator];
            }
        });
    });
}
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
function defer() {
    var deferred = {};
    deferred.promise = new Promise(function (resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
}
exports.defer = defer;
function inspect(promise) {
    var inspectable = {
        promise: null,
        isResolved: false,
        isRejected: false,
        isPending: true,
    };
    inspectable.promise = promise.then(function (value) {
        inspectable.isResolved = true;
        inspectable.isPending = false;
        return value;
    })
        .catch(function (err) {
        inspectable.isRejected = true;
        inspectable.isPending = false;
        return Promise.reject(err);
    });
    return inspectable;
}
exports.inspect = inspect;
function Try(cb) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, cb()];
        });
    });
}
exports.Try = Try;
// This logic is taken from Bluebird
function catchFilter(filters, err) {
    return (Array.isArray(filters) ? filters : [filters])
        .some(function (filter) {
        if (filter == null)
            return false;
        if (filter === Error ||
            filter.prototype instanceof Error) {
            if (err instanceof filter)
                return true;
        }
        else if (typeof filter === "function") {
            var filterFn = filter;
            // It is "ok" for this to throw. It'll be thrown back to the catch
            // handler, and the promise chain will contain this error.
            return filterFn(err);
        }
        else if (typeof filter === "object") {
            var obj = filter;
            for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
                var key = _a[_i];
                if (obj[key] != err[key])
                    return false;
            }
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