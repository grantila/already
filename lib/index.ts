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
	defer,
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
