[![npm version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage status][coverage-image]][coverage-url]

# Already

[![Greenkeeper badge](https://badges.greenkeeper.io/grantila/already.svg)](https://greenkeeper.io/)

`already` is a set of promise helper functions which many of them are also found in libraries such as Bluebird.

The functions are standalone and depends on no particular Promise implementation and therefore works well for Javascript's built-in Promise.

This library is written in TypeScript but is exposed as ES7 (if imported as `already`) and ES5 (if imported as `already/es5`). Typings are provided too, so any TypeScript project using this library will automatically get full type safety of all the functions.

# Functions

  * [delay](#delay)
  * [Finally](#finally)
  * [tap](#tap)
  * [props](#props)
  * [filter](#filter)
  * [map](#map)
  * [reduce](#reduce)
  * [each](#each)
  * [some](#some)
  * [defer](#defer)
  * [reflect](#reflect)
  * [inspect](#inspect)
  * [Try](#try)
  * [specific](#specific)
  * [rethrow](#rethrow)


## delay

The standalone `delay` function takes a milliseconds argument and returns a promise which is resolved after that time. An optional value can be given too, resolving in a promise with this future value.

```ts
import { delay } from 'already'

delay( 100 ).then( ( ) => console.log( "100ms has passed" ) )
// or
delay( 100, "foo" ).then( val => console.log( val ) )
```

It can also be used to delay a promise chain **if it is resolved**, using `delayChain`. The delay will be ignored if the upstream promise contains an error.

```ts
import { delayChain } from 'already'

somePromise
.then( delayChain( 100 ) )
```

To always delay a chain, regardless of whether it was resolved or rejected, use `finallyDelay`. **Note the triple dots**, and read more about `Finally` below...

```ts
import { finallyDelay } from 'already'

somePromise
.then( ...finallyDelay( 100 ) )
```

## Finally

An alternative for `promise.finally( fn )` (which isn't a standard *yet*) is the `Finally` helper. Note and *don't forget* the triple dots (`...`).
The callback given to `Finally` will be called regardless of whether the promise is resolved or rejected, and the promise' value/error flow will continue as if the `Finally` wasn't called. Also, the flow will *await* the inner `Finally` callback if it returns a promise.

Note; If the `Finally` callback either throws an error, or returns a promise which is rejected, **the flow will continue with this error** and not the upstream value/error.

If `already` is default-imported (`import already from 'already'`), a lower-case `finally` is provided (`already.finally( )`), but if used standalone, it must be capitalized as `Finally`, due to the free keyword `finally` being reserved in Javascript.

```ts
import { Finally } from 'already'

somePromise
.then( ...Finally( ( ) => { /* finally code goes here */ } ) )
```

## tap

A similar function to `then` is `tap` which is called only on resolved promises. The callback cannot alter the value flow of the promise, i.e. it cannot have a return value. This is useful for logging/debugging, etc. If it returns a promise, it will be awaited before letting the flow continue down the promise chain.

Note; If the `tap` callback either throws an error, or returns a promise which is rejected, **the flow will continue with this error** and not the upstream value.

```ts
import { tap } from 'already'

somePromise
.then( tap( value => { /* tap handler where the value is available */ } ) )
```

## props

As an alternative to `Promise.all( )` which awaits all promises in an array, `props( )` awaits all properties in an object.

The properties are enumerated and awaited as `Promise.all( )`, so if any of the promises are rejected, the same flow will happen as when calling `Promise.all( )` (i.e. the returned promise will contain the error/errors).

```ts
import { props } from 'already'

props( { a: someValue, b: somePromise } )
.then( ( { a, b } ) => { /* a and b are now values (not promises) */ } )
```

Obviously, `props` can be used in a promise chain, by just refering to the function rather than calling it.

```ts
import { props } from 'already'

Promise.resolve( { a: someValue, b: somePromise } )
.then( props )
.then( ( { a, b } ) => { /* a and b are now values (not promises) */ } )
```


## filter

The `filter` helper can operate on promises of arrays, and will do the same as waiting for all promises in the array and then applying `array.filter( )` on the result. If the filter callback returns a promise, it will be awaited (and expected to eventually become a `boolean`). This eventual value will determine whether to include the value or not in the resulting array.

```ts
import { filter } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( filter( item => item.shouldBeIncluded ) )
```

### filter concurrency

By default, the values will be filtered as fast as possible, but sometimes it is preferable to only spawn *n* number of filter callback calls concurrently, e.g. if they perform network/database requests. This can be done by providing an optional object with the `concurrency` property set. This will include awaiting both the upstream values (if the array contains promises) as well as the filter callback results if they are promises. New filter callbacks will not be called if more than *n* promises are being awaited.

```ts
import { filter } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( filter( { concurrency: 4 }, item => item.shouldBeIncluded ) )
```

### filter without a promise chain

The `filter` function can be called without a promise chain, and act on an array of values or promises as the first argument.

```ts
import { filter } from 'already'

const outArray = await filter( inArray, filterFun );
// or with custom concurrency:
const outArray = await filter( inArray, { concurrency: 4 }, filterFun );
```

## map

Same as with `filter`, `map` acts like awaiting all promises in an array, and then applying `array.map( )` on the result. Also, just like with `filter`, it will await the resulting promises from the map callback (if they actually are promises).

```ts
import { map } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( map( item => JSON.stringify( item ) ) )
```

### map concurrency

Like with `filter`, `map` allows a custom concurrency.

```ts
import { map } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( map( { concurrency: 4 }, item => JSON.stringify( item ) ) )
```

### map without a promise chain

The `map` function can be called without a promise chain, just like `filter`.

```ts
import { map } from 'already'

const outArray = await map( inArray, mapFun );
// or with custom concurrency:
const outArray = await map( inArray, { concurrency: 4 }, mapFun );
```


## reduce

Reducing (folding) over an iterable of values or promises is easily done with `reduce( )`. The reducer function can return promises, and they will be awaited before continuing with the next value.

The mechanism for this follows the reasoning behind Bluebird's [`reduce`](http://bluebirdjs.com/docs/api/promise.reduce.html) in how the initial value is handled, and the last argument in the reducer function being a number, not an array.

```ts
import { reduce } from 'already'

somePromiseToAnArray
.then( reduce( reducerFn[, initialValue ] ) )

// or on an array

reduce( arrayOrIterable, reducerFn[, initialValue ] )
```

If called within a promise chain (as the first example above), the `reduce` takes one or two arguments, a reducer function and an optional initial value.

If called outside a promise chain, it also takes the array (or any other iterable, or promise to any such) as the first argument.

The reducer function is on the format

```ts
reduce( accumulator: R, current: T, index: number, length: number ) => R | PromiseLike< R >;
```

The `accumulator` has the same type as the return value (although the return can be asynchronous), which is the *reduced* type `R`. The `current` is of type `T`, which is what the input array consists of (although it may consist of `PromiseLike< T >` too).

This means that the returned type from `reduce` doesn't need to be the same as the input, although **this is only true if `initialValue` is set**. If it is set, it will be used as the first `accumulator`, and `index` will begin at `0`. If `initialValue` is left unset (or is `undefined`), `R` and `T` must be the same, and  `index` will begin at `1`, since the first call will use the first index in the input as `accumulator` and the second as `current`.

`length` is the length of the input iterable/array, which is the same logic as in Bluebird, and **unlike** how Javascript's `Array.reduce` works (where you get the *array* as fourth argument).


## each

`each` iterates an array of promises or values, very much like `map`, although always serially as if `concurrency` was set to `1`.

The iterator function cannot return a value (or it will be ignored), but can return an empty promise which will be awaited before the next iteration. It's like `tap` but for elements in an array.

The return value of `each` is the input array unmodified.

If any of the iterator function calls throws an exception, or returns a rejected promise, the iteration will end and the return of `each` will be a promise rejected with this error.

```ts
import { each } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( each( item => { doSomethingWith( item ); } ) )
.then( /* input array is here and unmodified */ )

// or provide the array as first argument:

const outArray = await each( inArray, iteratorFun );
// outArray ~ inArray, not necessarily the *same* array, but the same content
```


## some

Just like filter, map and reduce which here are implemented closely mimicing the Array prototype functions but supporting asynchrony, `some` works similar to [`Array.some()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some). The return is different though, in that it doesn't necessarily return a promise to `true` or `false`, but rather a promise of the *truthy* value (of type `T`) or `false`.

The return type not being coerced to `true` upon match, makes it ideal in situations where `reduce` would otherwise be used only to find the first match. `some` may perform better, since it stops iterating on first match, while `reduce` would complete the iteration before it returns.

Like `filter`, `map` and `reduce` above, it supports a promise to a list, promises as values in the list, and an asynchronous predicate function.

```ts
import { some } from 'already'

somePromiseToAnArray
.then( some( predicateFn ) )
.then( ( t: T | false ) => { ... } ) // T is the return type of predicateFn

// or on an array

const t = some( arrayOrIterable, predicateFn );
// t is of type T (the return type of predicateFn) or false
```

### Example

```ts
import { some } from 'already'

const arr = [ 1, 2, 3 ];

async function pred( num: number ): Promise< string >
{
    // ... Implementation goes here
}

const val = await some( arr, pred );
// val is now either a string (the first truthy match) or false
```


## defer

The `defer` function template returns an object containing both a promise and its resolve/reject functions. This is generally an anti-pattern, and `new Promise( ... )` should be preferred, but this is sometimes necessary (or at least very useful).

```ts
import { defer } from 'already'

const deferred = defer< string >( );
deferred.promise; // The promise.
deferred.resolve; // The resolve function.
deferred.reject;  // The reject function.

deferred.resolve( "foo" ); // deferred.promise is now resolved to "foo"
```

### Empty defer

To create a defer object backed by a `Promise< void >`, creating it through `defer< void >( )` will not suffice. The returned object's `resolve` function will require an argument. Instead, create with an explicit void argument:

```ts
const deferred = defer( void 0 );
deferred.resolve( ); // This is now legal, typewise
```


## reflect

A promise can be either resolved or rejected, but sometimes it's convenient to have a shared flow for either occasion. That's when `reflect` comes in handy. It takes a promise as argument, and returns a promise to a `Reflection` object which contains the promise **or** error, and the booleans `isResolved` and `isRejected`.

```ts
import { reflect } from 'already'

const somePromise = Math.random( ) < 0.5
    ? Promise.resolve( 1 )
    : Promise.reject( new Error( ) );

const reflection = await reflect( somePromise );
const { value, error, isResolved, isRejected } = reflection;

if ( isResolved )
    doSomethingWithValue( value );
else
    handleError( error );
```


## inspect

In some cases is it useful to synchronously know if a promise is pending, resolved or rejected. Some promise libraries provide this on the promise as `isPending( )` functions e.g.

With `already`, wrap the promise in an *InspectablePromise* using the `inspect( )` function.

```ts
import { inspect } from 'already'

const inspectable = inspect( somePromise );
inspectable.promise    // <Promise> A new promise, chained from `somePromise`
inspectable.isPending  // <boolean>
inspectable.isResolved // <boolean>
inspectable.isRejected // <boolean>
```

**Note;** The returned object's promise must be used in the rest of the application, rather than the upstream promise (the one given as argument to `inspect`). It is technically not the same promise, and a rejection will otherwise likely result in an "Unhandled promise rejection" warning, or worse.

**Note;** The returned object will always be in *pending-mode* when the function returns, i.e. `isPending` will be `true` and `isResolved` and `isRejected` will both be `false`. Only after the next tick will these values have been settled. To ensure the right value "immediately", `await` the inspect return, to allow the value to settle:

```ts
import { inspect } from 'already'

const inspectable = await inspect( somePromise );
// inspectable.is{Pending|Resolved|Rejected} are now settled
```


## Try

The `Try` takes a callback function as argument and calls it. It guarantees to return a promise containing the value returned from the callback. If the function throws an exception, this will be caught and used to reject the promise with. `Try` can therefore never throw itself.

`Try` is often easily replaced with an `async function` in ES7 or newer versions of TypeScript.

```ts
import { Try } from 'already'

Try( ( ) => "foo" )
.then( val => console.log( val ) ); // Prints "foo"
```


## specific

The `specific` function can be used in a `.catch( ... )` handler to filter the catch for specific errors only. Its logic is taken from Bluebird's [`catch`](http://bluebirdjs.com/docs/api/catch.html).

The syntax is

```ts
specific( filter | [ filters ], handlerFn )
```

where the `filter` (or an array of such) is either an error constructor, a predicate function or an object, and `handlerFn` is the error handler.

Error constructors are checked with `instanceof`, predicate functions get the error object and must return `true` or `false`, and custom objects are shallowly checked key-by-key for `==` match. If the predicate function throws, the promise chain will contain this error.

```ts
import { specific } from 'already'

somePromise
.catch( specific( MyError, err => { /* handler */ } ) )
.catch( specific( isHttpClientError, err => { /* handler */ } ) )
.catch( specific( { minorIssue: true }, err => { /* handler */ } ) )
.catch( err => { /* any other error, OR if the above error handlers threw */ } )
```


## rethrow

Another `catch` helper is `rethrow` which allows a function to be called as an error handler, but ensures it rethrows the upstream error.
Note; if the callback function throws an error, or returns a rejected promise, this error will flow through rather than the upstream error.

The callback can either return nothing (synchronously) or an empty promise, which will be awaited before continuing with rethrowing.

The callback will get the error as argument.

```ts
import { rethrow } from 'already'

somePromise
.catch( rethrow( err => { /* handler */ } ) )
// the promise is still rejected
```

or, combined with `specific`:

```ts
import { specific, rethrow } from 'already'

somePromise
.catch( specific( MyError, rethrow( err => { /* handler */ } ) ) )
.catch( err => { /* handler */ } ) // will always be called, if somePromise was rejected
```


[npm-image]: https://img.shields.io/npm/v/already.svg
[npm-url]: https://npmjs.org/package/already
[travis-image]: https://img.shields.io/travis/grantila/already.svg
[travis-url]: https://travis-ci.org/grantila/already
[coverage-image]: https://coveralls.io/repos/github/grantila/already/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/grantila/already?branch=master
