'use strict'

import throat = require( 'throat' );

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
	reduce,
	some,
	defer,
	inspect,
	Try,
	specific,
}

export function delay( milliseconds: number ): Promise< void >;
export function delay< T >( milliseconds: number, t: T ): Promise< T >;

export function delay< T >( milliseconds: number, t?: T )
: Promise< void > | Promise< T >
{
	return new Promise< T >( ( resolve, reject ) =>
	{
		setTimeout( ( ) => resolve( t ), milliseconds );
	} );
}

export function delayChain( milliseconds: number )
: < T >( t?: T ) => Promise< T >
{
	return tap( ( ) => delay( milliseconds ) );
}

export function finallyDelay( milliseconds: number )
: FinallyWrapper
{
	return Finally( ( ) => delay( milliseconds ) );
}

export type FinallyWrapper =
	[ < T >( t?: T ) => Promise< T >, ( err?: any ) => any ];

export function Finally( fn: ( ) => ( void | PromiseLike< void > ) )
: FinallyWrapper
{
	async function _then< T >( t: T ): Promise< T >
	{
		await fn( );
		return t;
	}

	async function _catch( err: any )
	{
		await fn( );
		throw err;
	}

	return [ _then, _catch ];
}


export function tap<
	T,
	U,
	Fn extends ( T ) => ( void | PromiseLike< void > )
>
( fn: Fn )
: ( u: U ) => Promise< U >
{
	return async function( t: U ): Promise< U >
	{
		await fn( t );
		return t;
	};
}


export function props( obj: any ): Promise< any >
{
	const ret: any = { };

	const awaiters = [ ];

	for ( let prop of Object.keys( obj ) )
		awaiters.push(
			Promise.resolve( obj[ prop ] )
			.then( val => { ret[ prop ] = val; } )
		);

	return Promise.all( awaiters ).then( ( ) => ret );
}

export interface ConcurrencyOptions
{
	concurrency: number;
}
export type FilterMapOptions = Partial< ConcurrencyOptions >;
const defaultFilterMapOptions: FilterMapOptions = { concurrency: Infinity };

export type MapFn< T, U > =
	( t: T, index: number, arr: Array< T | PromiseLike< T > > ) =>
		U | Promise< U >;
export type FilterFn< T > = MapFn< T, boolean >;

export function filter< T >( filterFn: FilterFn< T > )
: ( t: Array< T | PromiseLike< T > > ) => Promise< Array< T > >;
export function filter< T >( opts: FilterMapOptions, filterFn: FilterFn< T > )
: ( t: Array< T | PromiseLike< T > > ) => Promise< Array< T > >;
export function filter< T >(
	arr: Array< T | PromiseLike< T > >,
	filterFn: FilterFn< T >
) : Promise< Array< T > >;
export function filter< T >(
	arr: Array< T | PromiseLike< T > >,
	opts: FilterMapOptions,
	filterFn: FilterFn< T >
) : Promise< Array< T > >;

export function filter< T >(
	arr: Array< T | PromiseLike< T > > | FilterFn< T > | FilterMapOptions,
	opts?: FilterFn< T > | FilterMapOptions,
	filterFn?: FilterFn< T >
)
:
	( ( t: Array< T | PromiseLike< T > > ) => Promise< Array< T > > ) |
	( Promise< Array< T > > )
{
	if ( Array.isArray( arr ) )
	{
		if ( typeof opts === 'function' )
		{
			filterFn = opts;
			opts = defaultFilterMapOptions;
		}
		return filter( opts, filterFn )( arr );
	}

	if ( typeof arr === 'function' )
	{
		filterFn = arr;
		opts = defaultFilterMapOptions;
	}
	else
	{
		filterFn = < FilterFn< T > >opts;
		opts = arr;
	}

	const wrappedFilterFn =
		( val: T, index: number, arr: Array< T | PromiseLike< T > > ) =>
			Promise.resolve( filterFn( val, index, arr ) )
			.then( ok => ( { ok, val } ) );

	return function( t: Array< T | PromiseLike< T > > ): Promise< T[] >
	{
		return map( < FilterMapOptions >opts, wrappedFilterFn )( t )
		.then( values =>
			values
			.filter( ( { ok } ) => ok )
			.map( ( { val } ) => val )
		);
	}
}

export function map< T, U >( mapFn: MapFn< T, U > )
: ( t: Array< T | PromiseLike< T > > ) => Promise< Array< U > >;
export function map< T, U >( opts: FilterMapOptions, mapFn: MapFn< T, U > )
: ( t: Array< T | PromiseLike< T > > ) => Promise< Array< U > >;
export function map< T, U >(
	arr: Array< T | PromiseLike< T > >,
	mapFn: MapFn< T, U >
) : Promise< Array< U > >;
export function map< T, U >(
	arr: Array< T | PromiseLike< T > >,
	opts: FilterMapOptions,
	mapFn: MapFn< T, U >
) : Promise< Array< U > >;

export function map< T, U >(
	arr: Array< T | PromiseLike< T > > | MapFn< T, U > | FilterMapOptions,
	opts?: MapFn< T, U > | FilterMapOptions,
	mapFn?: MapFn< T, U >
)
:
	( ( t: Array< T | PromiseLike< T > > ) => Promise< Array< U > > ) |
	( Promise< Array< U > > )
{
	if ( Array.isArray( arr ) )
	{
		if ( typeof opts === 'function' )
		{
			mapFn = opts;
			opts = defaultFilterMapOptions;
		}
		return map( opts, mapFn )( arr );
	}

	if ( typeof arr === 'function' )
	{
		mapFn = arr;
		opts = defaultFilterMapOptions;
	}
	else
	{
		mapFn = < MapFn< T, U > >opts;
		opts = arr;
	}

	const { concurrency = Infinity } = opts;

	const promiseMapFn =
		( t: T, index: number, arr: Array< T | PromiseLike< T > > ) =>
			Promise.resolve( mapFn( t, index, arr ) );

	const throated = throat( concurrency );

	return function( t: Array< T | PromiseLike< T > > ): Promise< Array< U > >
	{
		return Promise.resolve( t )
		.then( ( values: Array< T | PromiseLike< T > > ) =>
			values.map(
				( val, index, arr ) =>
					throated( ( ) => Promise.resolve( val ) )
					.then( ( val: T ) =>
						throated( ( ) => promiseMapFn( val, index, arr ) )
					)
			)
		)
		.then( values => Promise.all( values ) );
	};
}


export type SyncReduceInput< T > = Iterable< T | PromiseLike< T > >;

export type ReduceInput< T > =
	SyncReduceInput< T > |
	PromiseLike< SyncReduceInput< T > >;

export type ReduceFunction< T, R > =
	( accumulator: R, current: T, index: number, length: number ) =>
		R | PromiseLike< R >;

export async function reduce< T >(
	input: ReduceInput< T >,
	reducer: ReduceFunction< T, T >
)
: Promise< T | undefined >;

export async function reduce< T, R >(
	input: ReduceInput< T >,
	reducer: ReduceFunction< T, R >,
	initialValue: R | PromiseLike< R >
)
: Promise< R | undefined >;

export function reduce< T >(
	reducer: ReduceFunction< T, T >
)
: < U extends SyncReduceInput< T > >( input: U ) => Promise< T | undefined >;

export function reduce< T, R >(
	reducer: ReduceFunction< T, R >,
	initialValue: R | PromiseLike< R >
)
: < U extends SyncReduceInput< T > >( input: U ) => Promise< R | undefined >;

export function reduce< T, R >(
	input: ReduceInput< T > | ReduceFunction< T, R >,
	reducer?: ReduceFunction< T, R > | R | PromiseLike< R >,
	initialValue?: R | PromiseLike< R >
)
:
	( Promise< R | undefined > )
	|
	( < U extends SyncReduceInput< T > >( input: U ) => Promise< R | undefined > )
{
	if ( typeof input === 'function' )
	{
		initialValue = < R >reducer;
		const _reducer = < ReduceFunction< T, R > >input;
		return async function< U extends SyncReduceInput< T > >( input: U )
		{
			return reduceImpl( input, _reducer, initialValue );
		}
	}

	return reduceImpl(
		< ReduceInput< T > >input,
		< ReduceFunction< T, R > >reducer,
		initialValue
	);
}

async function reduceImpl< T, R >(
	input: ReduceInput< T >,
	reducer: ReduceFunction< T, R >,
	initialValue?: R | PromiseLike< R >
)
: Promise< R | undefined >
{
	const _input = Array.from< T | PromiseLike< T > >( await input );
	const _initialValue = await initialValue;

	if ( _input.length === 0 )
		return _initialValue;

	const usingInitialValue = typeof _initialValue !== 'undefined';

	const length = _input.length;
	let index = usingInitialValue ? 0 : 1;

	let accumulator: R =
		usingInitialValue
		? _initialValue
		// This cast should be safe if the interface is respected
		: < R >< any >await _input.shift( );

	while ( _input.length > 0 )
		accumulator = await reducer(
			accumulator, await _input.shift( ), index++, length );

	return accumulator;
}


export type SomeReturn< R > = Promise< R | false >;
export type SomeSyncReturn< R > = SomeReturn< R > | R | false;
export type SomePredicate< T, R > = ( T ) => SomeSyncReturn< R >;
export type SomeArray< T > =
	ReadonlyArray< T | PromiseLike< T > >
	|
	PromiseLike< ReadonlyArray< T | PromiseLike< T > > >;

export function some< T, R >(
	list: SomeArray< T >,
	fn: SomePredicate< T, R >
)
: SomeReturn< R >;

export function some< T, R >( fn: SomePredicate< T, R > )
: ( list: SomeArray< T > ) => SomeReturn< R >;

export function some< T, R >(
	list: SomeArray< T > | SomePredicate< T, R >,
	fn?: SomePredicate< T, R >
)
:
	SomeReturn< R >
	|
	( ( list: SomeArray< T > ) => SomeReturn< R > )
{
	if ( typeof list === 'function' )
	{
		fn = list;
		return ( list: SomeArray< T > ) => someImpl( list, fn );
	}

	return someImpl( list, fn );
}

async function someImpl< T, R >(
	list: SomeArray< T >,
	fn: SomePredicate< T, R >
)
: Promise< R | false >
{
	const _list = await list;

	for ( let i = 0; i < _list.length; ++i )
	{
		const ret = await fn( await _list[ i ] );
		if ( ret )
			return ret;
	}

	return false;
}


export interface Deferred< T >
{
	resolve: ( t: T | PromiseLike< T > ) => void;
	reject: < E extends Error >( err: E ) => void;
	promise: Promise< T >;
}

/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export function defer< T >( ): Deferred< T >
{
	const deferred = < Deferred< T > >{ };
	deferred.promise = new Promise< T >( ( resolve, reject ) =>
	{
		deferred.resolve = resolve;
		deferred.reject = reject;
	} );
	return deferred;
}


export interface InspectablePromise< T >
{
	promise: Promise< T >;
	isResolved: boolean;
	isRejected: boolean;
	isPending: boolean;
}
export function inspect< T >( promise: Promise< T > ) : InspectablePromise< T >
{
	const inspectable: InspectablePromise< T > = {
		promise: null,
		isResolved: false,
		isRejected: false,
		isPending: true,
	};

	inspectable.promise = promise.then( value =>
	{
		inspectable.isResolved = true;
		inspectable.isPending = false;
		return value;
	} )
	.catch( err =>
	{
		inspectable.isRejected = true;
		inspectable.isPending = false;
		return Promise.reject( err );
	} );

	return inspectable;
}


export async function Try< T >( cb: ( ) => T ): Promise< T >
{
	return cb( );
}


export type ErrorFilterFunction = ( err: Error ) => boolean;
export type ErrorFilterObject = { [ key: string ]: any };

export type CatchFilter =
	ErrorConstructor |
	ErrorFilterFunction |
	ErrorFilterObject;

// This logic is taken from Bluebird
function catchFilter( filters: CatchFilter | Array< CatchFilter >, err: Error )
: boolean
{
	return ( Array.isArray( filters ) ? filters : [ filters ] )
	.some( ( filter: CatchFilter ) =>
	{
		if ( filter == null )
			return false;

		if (
			filter === Error ||
			( < ErrorConstructor >filter ).prototype instanceof Error )
		{
			if ( err instanceof < ErrorConstructor >filter )
				return true;
		}
		else if ( typeof filter === "function" )
		{
			const filterFn = < ErrorFilterFunction >filter;

			// It is "ok" for this to throw. It'll be thrown back to the catch
			// handler, and the promise chain will contain this error.
			return filterFn( err );
		}
		else if ( typeof filter === "object" )
		{
			const obj = < ErrorFilterObject >filter;

			for ( const key of Object.keys( obj ) )
				if ( obj[ key ] != err[ key ] )
					return false;
			return true;
		}

	} );
}

export function specific< T >(
	filters: CatchFilter | Array< CatchFilter >,
	handler: ( err: Error ) => T
)
: ( err: Error ) => ( T | Promise< T > )
{
	return function( err: Error )
	{
		if ( !catchFilter( filters, err ) )
			throw err;

		return handler( err );
	}
}
