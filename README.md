[![npm version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]

# Already

`already` is a set of promise helper functions which are also found in libraries such as Bluebird.

The functions are standalone and depends on no particular Promise implementation and therefore works well for Javascript's built-in Promise.

This library is written in TypeScript but is exposed as ES7 (if imported as `already`) and ES5 (if imported as `already/es5`). Typings are provided too, so any TypeScript project using this library will automatically get full type safety of all the functions.

# Functions

  * [delay](#delay)
  * [Finally](#finally)
  * [tap](#tap)
  * [props](#props)
  * [filter](#filter)
  * [map](#map)
  * [defer](#defer)
  * [Try](#try)


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

Same as with `filter`, `map` acts like awaiting all promises in an array, and then applying `array.map( )` on the result. Also, just like with `map`, it will also await the resulting promises from the map callback (if they actually are promises).

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

## defer

The `defer` function template returns an object containing both a promise and its resolver/rejected functions. This is generally an anti-pattern, and `new Promise( ... )` should be preferred, but this is sometimes necessary (or at least very useful).

```ts
import { defer } from 'already'

const deferred = defer< string >( );
deferred.promise; // The promise.
deferred.resolve; // The resolve function.
deferred.reject;  // The reject function.

deferred.resolve( "foo" ); // deferred.promise is now resolved to "foo"
```


## Try

The `Try` takes a callback function as argument and calls it. It guarantees to return a promise containing the value returned from the callback. If the function throws an exception, this will be caught and used to reject the promise with. `Try` can therefore never throw itself.

`Try` is often easily replaced with an `async function` in ES7 or newer versions of TypeScript.

```ts
import { Try } from 'already'

Try( ( ) => "foo" )
.then( val => console.log( val ) ); // Prints "foo"
```


[npm-image]: https://img.shields.io/npm/v/already.svg
[npm-url]: https://npmjs.org/package/already
[travis-image]: https://img.shields.io/travis/grantila/already.svg
[travis-url]: https://travis-ci.org/grantila/already
