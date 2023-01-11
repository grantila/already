export default {
	defer,
	deferSet,
	delay,
	delayChain,
	each,
	filter,
	flatMap,
	funnel,
	inspect,
	map,
	once,
	props,
	reduce,
	rethrow,
	retry,
	some,
	specific,
	tap,
	wrapFunction,
};


/**
 * IfPromise< P, T[, U] > returns T if P is a promise, otherwise returns U (or
 * fallbacks to <never> ).
 */
export type IfPromise< P, T, U = never > =
	P extends Promise< infer _X > ? T : U;

/**
 * IfNotPromise< P, T[, U] > returns U (fallbacks to <never>) if P is a
 * promise, otherwise returns T.
 */
export type IfNotPromise< P, T, U = never > =
	P extends Promise< infer _X > ? U : T;

/**
 * Returns the Promise wrapped value of P, unless it's already a promise, where
 * the promise itself is returned instead.
 *
 * For P being Promise<E>, it returns P
 * For non-promise P, it returns Promise<P>
 */
export type PromiseOf< P > = P extends Promise< infer _U > ? P : Promise< P >;

/**
 * Returns the element type of a promise, or the type itself if it isn't
 * wrapped in a promise.
 *
 * For P being Promise<E>, it returns E
 * For non-promise P, it returns P
 */
export type PromiseElement< P > = P extends Promise< infer U > ? U : P;

/**
 * Given type P, returns the same type P if it is a Promise, otherwise never.
 */
export type EnsurePromise< P > = P extends Promise< infer _U > ? P : never;

/**
 * Given type T, returns the same type T if it is *not* a Promise, otherwise
 * never.
 */
export type EnsureNotPromise< T > = T extends Promise< infer _U > ? never : T;


function toReadonlyArray< T >( arr: ConcatArray< T > ): ReadonlyArray< T >
{
	/* istanbul ignore else */
	if ( typeof ( < ReadonlyArray< T > >arr ).map === "function" )
		return < ReadonlyArray< T > >arr;
	else
		return Array.from( arr );
}


type ConcurrentQueueRunner< R > = ( ) => R | PromiseLike< R >;

interface ConcurrentQueueItem< R >
{
	cb: ConcurrentQueueRunner< R >;
	deferred: Deferred< R >;
}

interface ConcurrentQueue< R >
{
	size: number;
	count: number;
	queue: Array< ConcurrentQueueItem< R > >;
	process: any;
	runOne: ( cb: ConcurrentQueueRunner< R > ) => Promise< R >;
	enqueue: ( cb: ConcurrentQueueRunner< R > ) => Promise< R >;
}

export type Callback< R, A extends any[ ] > =
	( ...args: A ) => Promise< R >;

/**
 * Create a maximum concurrency for fn (can be curried)
 *
 * Either specify fn and invoke the returned function, or skip fn and the
 * returned function will take an arbitrary function to limit concurrency for.
 *
 * @param size Concurrency limit
 * @param fn The function to limit the concurrency for
 * @returns Concurrency-limited version of fn
 */
export function concurrent< R, A extends any[ ] >(
	size: number,
	fn: Callback< R, A >
): ( ...a: A ) => Promise< R >;

export function concurrent( size: number )
: < R, A extends any[ ] >( fn: Callback< R, A >, ...a: A ) => Promise< R >;

export function concurrent< R, A extends any[ ] >(
	size: number,
	fn?: Callback< R, A >
)
{
	const queue = makeQueue< R >( size );

	if ( size < 1 )
		throw new RangeError( `Size must be at least 1` );

	if ( !fn )
		return ( cb: Callback< R, A >, ...args: A ) =>
			queue.enqueue( ( ) => cb( ...args ) );
	else
		return ( ...args: A ): Promise< R > =>
			queue.enqueue( ( ) => fn( ...args ) );
}

function makeQueue< R >( size: number ): ConcurrentQueue< R >
{
	const queue: ConcurrentQueue< R > = {
		size,
		count: 0,
		queue: [ ],
		process: ( ) =>
		{
			if ( queue.queue.length )
			{
				const first = queue.queue.shift( )!;

				const { cb, deferred } = first;

				queue.runOne( cb ).then( deferred.resolve, deferred.reject );
			}
		},
		runOne: ( cb: ConcurrentQueueRunner< R > ) =>
		{
			++queue.count;
			return ( async ( ) => cb( ) )( )
				.finally( ( ) =>
				{
					--queue.count;
					queue.process( );
				} );
		},
		enqueue: async ( cb: ConcurrentQueueRunner< R > ) =>
		{
			if ( queue.count >= queue.size )
			{
				const deferred = defer< R >( );
				queue.queue.push( { cb, deferred } );
				return deferred.promise;
			}

			return queue.runOne( cb );
		}
	};

	return queue;
}


export function delay( milliseconds: number ): Promise< void >;
export function delay< T >( milliseconds: number, t: T ): Promise< T >;

export function delay< T >( milliseconds: number, t?: T )
: Promise< void > | Promise< T >
{
	return new Promise< T >( resolve =>
	{
		setTimeout( ( ) => resolve( t as T ), milliseconds );
	} );
}

export function delayChain( milliseconds: number )
: < T >( t: T ) => Promise< T >
{
	return tap( ( ) => delay( milliseconds ) );
}


export function tap<
	U,
	Fn extends ( t: U ) => ( void | PromiseLike< void > )
>( fn: Fn )
: ( u: U ) => Promise< U >
{
	return async ( t: U ): Promise< U > =>
	{
		await fn( t );
		return t;
	};
}


export function props( obj: any ): Promise< any >
{
	const ret: any = { };

	const awaiters = [ ];

	for ( const prop of Object.keys( obj ) )
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
export interface ChunkOptions
{
	chunk: number | 'idle';
}
export type FilterMapOptions = Partial< ConcurrencyOptions | ChunkOptions >;
const defaultFilterMapOptions: FilterMapOptions = {
	concurrency: Infinity
};

export type MapArray< T > =
	Array< T | PromiseLike< T > > |
	ConcatArray< T | PromiseLike< T > >;

export type MapFn< T, U > =
	( t: T, index: number, arr: MapArray< T > ) =>
		U | Promise< U >;
export type FlatMapFn< T, U > =
	( t: T, index: number, arr: MapArray< T > ) =>
		| U
		| ConcatArray< U | Promise< U > >
		| Array< U | Promise< U > >
		| Promise<
			| U
			| ConcatArray< U | Promise< U > >
			| Array< U | Promise< U > >
		>;
export type FilterFn< T > = MapFn< T, boolean >;

export function filter< T >( filterFn: FilterFn< T > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > >;
export function filter< T >( opts: FilterMapOptions, filterFn: FilterFn< T > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > >;
export function filter< T >(
	arr: ConcatArray< T | PromiseLike< T > >,
	filterFn: FilterFn< T >
): Promise< Array< T > >;
export function filter< T >(
	arr: ConcatArray< T | PromiseLike< T > >,
	opts: FilterMapOptions,
	filterFn: FilterFn< T >
): Promise< Array< T > >;

export function filter< T >(
	arr: ConcatArray< T | PromiseLike< T > > | FilterFn< T > | FilterMapOptions,
	opts?: FilterFn< T > | FilterMapOptions,
	filterFn?: FilterFn< T >
)
:
	( ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > > ) |
	( Promise< Array< T > > )
{
	if ( Array.isArray( arr ) )
	{
		if ( typeof opts === "function" )
		{
			filterFn = opts;
			opts = defaultFilterMapOptions;
		}
		const intermediate =
			filter( < FilterMapOptions >opts, < FilterFn< T > >filterFn );
		return intermediate( arr );
	}

	filterFn = typeof arr === "function" ? arr : < FilterFn< T > >opts;
	opts =
		typeof arr === "function"
		? defaultFilterMapOptions
		: < FilterMapOptions >arr;

	const wrappedFilterFn =
		( val: T, index: number, arr: MapArray< T > ) =>
			Promise.resolve( ( < FilterFn< T > >filterFn )( val, index, arr ) )
			.then( ok => ( { ok, val } ) );

	return ( t: ConcatArray< T | PromiseLike< T > > ): Promise< Array< T > > =>
	{
		return map( < FilterMapOptions >opts, wrappedFilterFn )( t )
		.then( values =>
			values
			.filter( ( { ok } ) => ok )
			.map( ( { val } ) => val )
		);
	};
}

export function map< T, U >( mapFn: MapFn< T, U > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< U > >;
export function map< T, U >( opts: FilterMapOptions, mapFn: MapFn< T, U > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< U > >;
export function map< T, U >(
	arr: ConcatArray< T | PromiseLike< T > >,
	mapFn: MapFn< T, U >
): Promise< Array< U > >;
export function map< T, U >(
	arr: ConcatArray< T | PromiseLike< T > >,
	opts: FilterMapOptions,
	mapFn: MapFn< T, U >
): Promise< Array< U > >;

export function map< T, U >(
	arr:
		ConcatArray< T | PromiseLike< T > > |
		MapFn< T, U > |
		FilterMapOptions,
	opts?: MapFn< T, U > | FilterMapOptions,
	mapFn?: MapFn< T, U >
)
:
	( ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< U > > ) |
	( Promise< Array< U > > )
{
	if ( Array.isArray( arr ) )
	{
		if ( typeof opts === "function" )
		{
			mapFn = opts;
			opts = defaultFilterMapOptions;
		}
		return map( < FilterMapOptions >opts, < MapFn< T, U > >mapFn )( arr );
	}

	mapFn = typeof arr === "function" ? arr : < MapFn< T, U > >opts;
	opts =
		typeof arr === "function"
		? defaultFilterMapOptions
		: < FilterMapOptions >arr;

	const promiseMapFn =
		( t: T, index: number, arr: ConcatArray< T | PromiseLike< T > > ) =>
			Promise.resolve( ( < MapFn< T, U > >mapFn )( t, index, arr ) );

	const { concurrency = Infinity } = opts as Partial< ConcurrencyOptions >;
	const { chunk } = opts as Partial< ChunkOptions >;

	if ( typeof chunk !== 'undefined' )
	{
		if ( typeof chunk !== 'number' && chunk !== 'idle' )
			throw new Error( `Invalid 'chunk' option to 'map': ${chunk}` );

		const useIdle = chunk === 'idle';
		const timeout =
			chunk === 'idle'
			? 15 // 15ms, allow 1.666ms for browser work (to fill up 16.666 ms)
			: chunk;

		const looper = async ( cb: ( timeout: number ) => Promise< void > ) =>
			new Promise< void >( ( resolve, reject ) =>
			{
				const resolver = async ( timeout: number ) =>
				{
					try
					{
						await cb( timeout );
						resolve( );
					}
					catch ( err )
					{
						reject( err );
					}
				}

				( useIdle && typeof requestIdleCallback !== 'undefined' )
				? requestIdleCallback(
					idleDeadline =>
						resolver(
							// Round down to millisecond, subtract 1.
							// That gives a little bit of time for the browser
							// to do whatever it wants, and will to some
							// degree prevent us to step over the time budget.
							Math.floor( idleDeadline.timeRemaining( ) ) - 1
						),
						{ timeout: 0 }
				)
				: setTimeout( ( ) => resolver( timeout ), 0 );
			} );

		return ( t: ConcatArray< T | PromiseLike< T > > )
		: Promise< Array< U > > =>
		{
			return Promise.resolve( t )
			.then( async ( values: ConcatArray< T | PromiseLike< T > > ) =>
			{
				const arr = toReadonlyArray( values );
				const ret: Array< U > = [ ];
				let i = 0;

				const loop = async ( timeout: number ) =>
				{
					const start = Date.now( );

					for ( ; i < arr.length; )
					{
						const u = await promiseMapFn( await arr[ i ], i, arr );
						ret.push( u );
						++i;

						if ( Date.now( ) - start >= timeout )
						{
							await looper( loop );
							break;
						}
					}
				}

				await loop( timeout );

				return ret;
			} )
			.then( values => Promise.all( values ) );
		};
	}

	const concurrently = concurrent( concurrency );

	return ( t: ConcatArray< T | PromiseLike< T > > )
	: Promise< Array< U > > =>
	{
		return Promise.resolve( t )
		.then( ( values: ConcatArray< T | PromiseLike< T > > ) =>
			toReadonlyArray( values )
			.map( ( val, index, arr ) =>
				( ( ) => Promise.resolve( val ) )( )
				.then( ( val: T ) =>
					concurrently( promiseMapFn, val, index, arr )
				)
			)
		)
		.then( values => Promise.all( values ) );
	};
}


export function flatMap< T, U >( mapFn: FlatMapFn< T, U > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< U > >;
export function flatMap< T, U >(
	opts: FilterMapOptions, mapFn: FlatMapFn< T, U >
): ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< U > >;
export function flatMap< T, U >(
	arr: ConcatArray< T | PromiseLike< T > >,
	mapFn: FlatMapFn< T, U >
): Promise< Array< U > >;
export function flatMap< T, U >(
	arr: ConcatArray< T | PromiseLike< T > >,
	opts: FilterMapOptions,
	mapFn: FlatMapFn< T, U >
): Promise< Array< U > >;

export function flatMap< T, U >(
	arr:
		ConcatArray< T | PromiseLike< T > > |
		FlatMapFn< T, U > |
		FilterMapOptions,
	opts?: FlatMapFn< T, U > | FilterMapOptions,
	mapFn?: FlatMapFn< T, U >
)
:
	( ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< U > > ) |
	( Promise< Array< U > > )
{
	if ( Array.isArray( arr ) )
	{
		return map(
			arr,
			opts as FilterMapOptions,
			mapFn as FlatMapFn< T, U >
		)
		.then( arr =>
			Promise.all(
				arr
				.map( inner => Array.isArray( inner ) ? inner : [ inner ] )
				.flat( 1 ) as Array< U | Promise< U > >
			)
		);
	}

	return async ( t: ConcatArray< T | PromiseLike< T > > )
	: Promise< Array< U > > =>
	{
		return flatMap(
			t,
			arr as FilterMapOptions,
			opts as FlatMapFn< T, U >
		);
	};
}


export type SyncReduceInput< T > = Iterable< T | PromiseLike< T > >;

export type ReduceInput< T > =
	SyncReduceInput< T > |
	PromiseLike< SyncReduceInput< T > >;

export type ReduceFunction< T, R > =
	( accumulator: R, current: T, index: number, length: number ) =>
		R | PromiseLike< R >;

export async function reduce< T, R >(
	input: ReduceInput< T >,
	reducer: ReduceFunction< T, R >
)
: Promise< R | undefined >;

export async function reduce< T, R >(
	input: ReduceInput< T >,
	reducer: ReduceFunction< T, R >,
	initialValue: R | PromiseLike< R >
)
: Promise< R >;

export function reduce< T, R >(
	reducer: ReduceFunction< T, R >
)
: < U extends SyncReduceInput< T > >( input: U ) => Promise< R | undefined >;

export function reduce< T, R >(
	reducer: ReduceFunction< T, R >,
	initialValue: R | PromiseLike< R >
)
: < U extends SyncReduceInput< T > >( input: U ) => Promise< R >;

export function reduce< T, R >(
	input: ReduceInput< T > | ReduceFunction< T, R >,
	reducer?: ReduceFunction< T, R > | R | PromiseLike< R >,
	initialValue?: R | PromiseLike< R >
)
:
	( Promise< R | undefined > )
	|
	( < U extends SyncReduceInput< T > >( input: U ) =>
		Promise< R | undefined >
	)
{
	if ( typeof input === "function" )
	{
		initialValue = < R >reducer;
		const _reducer = < ReduceFunction< T, R > >input;
		return async < U extends SyncReduceInput< T > >( input: U ) =>
		{
			return reduceImpl( input, _reducer, initialValue );
		};
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

	const usingInitialValue = typeof _initialValue !== "undefined";

	const length = _input.length;
	let index = usingInitialValue ? 0 : 1;

	let accumulator: R =
		usingInitialValue
		? < R >_initialValue
		// This cast should be safe if the interface is respected
		: < R >< any >await _input.shift( );

	while ( _input.length > 0 )
		accumulator = await reducer(
			accumulator, < T >await _input.shift( ), index++, length );

	return accumulator;
}


const defaultEachOptions: FilterMapOptions = {
	concurrency: 1
};

export type EachFn< T > =
	( t: T, index: number, length: number ) => void | Promise< void >;

export function each< T >( eachFn: EachFn< T > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > >;
export function each< T >( opts: FilterMapOptions, eachFn: EachFn< T > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > >;
export function each< T >(
	arr: ConcatArray< T | PromiseLike< T > >,
	eachFn: EachFn< T >
): Promise< Array< T > >;
export function each< T >(
	arr: ConcatArray< T | PromiseLike< T > >,
	opts: FilterMapOptions,
	eachFn: EachFn< T >
): Promise< Array< T > >;

export function each< T >(
	arr: ConcatArray< T | PromiseLike< T > > | EachFn< T > | FilterMapOptions,
	opts?: EachFn< T > | FilterMapOptions,
	eachFn?: EachFn< T >
)
:
	( ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > > ) |
	( Promise< Array< T > > )
{
	if ( Array.isArray( arr ) )
	{
		if ( typeof opts === "function" )
		{
			eachFn = opts;
			opts = defaultEachOptions;
		}

		const _opts = < FilterMapOptions >opts;

		return eachImpl( _opts, eachFn! )( arr );
	}

	if ( typeof arr === "function" )
	{
		eachFn = arr;
		opts = defaultEachOptions;
	}
	else
	{
		eachFn = opts as EachFn< T >;
		opts = arr as FilterMapOptions;
	}

	const _opts = < FilterMapOptions >opts;

	return eachImpl( _opts, eachFn! );
}

function eachImpl< T >( opts: FilterMapOptions, eachFn: EachFn< T > )
: ( t: ConcatArray< T | PromiseLike< T > > ) => Promise< Array< T > >
{
	return async ( arr: ConcatArray< T | PromiseLike< T > > )
	: Promise< Array< T > > =>
	{
		const length = arr.length;

		async function iterator( t: T, index: number )
		{
			await eachFn( t, index, length );
			return t;
		}
		return map( arr, opts, iterator );
	};
}


export type SomeReturn< R > = Promise< R | false >;
export type SomeSyncReturn< R > = SomeReturn< R > | R | false;
export type SomePredicate< T, R > = ( t: T ) => SomeSyncReturn< R >;
export type SomeArray< T > =
	ConcatArray< T | PromiseLike< T > >
	|
	PromiseLike< ConcatArray< T | PromiseLike< T > > >;

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
	if ( typeof list === "function" )
	{
		fn = list;
		return ( list: SomeArray< T > ) =>
			someImpl( list, < SomePredicate< T, R > >fn );
	}

	return someImpl( list, < SomePredicate< T, R > >fn );
}

async function someImpl< T, R >(
	list: SomeArray< T >,
	fn: SomePredicate< T, R >
)
: Promise< R | false >
{
	const _list = toReadonlyArray( await list );

	for ( const val of _list )
	{
		const ret = await fn( await val );
		if ( ret )
			return ret;
	}

	return false;
}


export type OnceRunnee< T, R > =
	T extends void ? ( ( ) => R ) : ( ( t: T ) => R );
export interface OnceRunner
{
	< T, R >( fn: OnceRunnee< T, R >, t: T ): R;
	< R >( fn: OnceRunnee< void, R > ): R;
}

export function once( ): OnceRunner;
export function once< R >( fn: OnceRunnee< void, R > ): OnceRunnee< void, R >;
export function once< T, R >( fn: OnceRunnee< T, R > ): OnceRunnee< T, R >;
export function once< T, R >( fn?: OnceRunnee< T, R > )
: OnceRunner | OnceRunnee< T, R >
{
	if ( fn )
	{
		const _once = onceDynamic( );
		return ( ( t: T ) => _once( fn, t ) ) as OnceRunnee< T, R >;
	}
	else
		return onceDynamic( );
}

interface OnceState< T >
{
	hasRun: boolean;
	returnValue?: T;
	deferred?: EmptyDeferred | Deferred< T >;
}

function onceDynamic( ): OnceRunner
{
	const state = new WeakMap< any, OnceState< any > >( );

	const ensureState = ( fn: any ) =>
	{
		if ( !state.has( fn ) )
			state.set( fn, { hasRun: false } );
	};

	return ( < T, R >( fn: OnceRunnee< T, R >, t: T ) =>
	{
		ensureState( fn );
		const stateObject = < OnceState< R > >state.get( fn );

		if ( stateObject.hasRun )
		{
			if ( stateObject.deferred )
				return stateObject.deferred.promise;
			return stateObject.returnValue;
		}

		stateObject.hasRun = true;
		const ret = fn( t );
		const pret = < Promise< T > >< any >ret;
		if ( pret !== undefined && pret && typeof pret.then === "function" )
		{
			stateObject.deferred = defer( void 0 );
			return < any >pret
				.then(
					stateObject.deferred.resolve,
					rethrow( stateObject.deferred.reject )
				)
				.then( ( ) =>
					( < Deferred< R > >stateObject.deferred ).promise
				);
		}
		stateObject.returnValue = ret;
		return ret;
	} ) as OnceRunner;
}


export function retry< R >(
	times: number,
	fn: ( ) => R,
	retryable: ( err: unknown ) => boolean = ( ) => true
)
: R
{
	type I = PromiseElement< R >;

	const retryAsync = ( promise: Promise< I > ): Promise< I > =>
		promise
		.catch( ( err: Error ) =>
		{
			if ( --times < 0 || !retryable( err ) )
				throw err;

			return retryAsync( < any >fn( ) );
		} );

	const retrySync = ( _err: unknown ): R =>
	{
		while ( --times >= 0 )
		{
			try
			{
				return < R >fn( );
			}
			catch ( err )
			{
				if ( !retryable( err ) )
					throw err;

				_err = err;
			}
		}

		throw _err;
	};

	try
	{
		const ret = fn( );

		if (
			ret &&
			typeof ret === "object" &&
			typeof ( < any >ret ).then === "function"
		)
		{
			return < any >retryAsync( < any >ret );
		}

		return < R >ret;
	}
	catch ( err )
	{
		if ( !retryable( err ) )
			throw err;

		return retrySync( err );
	}
}


export interface Deferred< T >
{
	resolve: ( t: T | PromiseLike< T > ) => void;
	reject: < E extends Error >( err: E ) => void;
	promise: Promise< T >;
}

export interface EmptyDeferred
{
	resolve: ( ( t: void | PromiseLike< void > ) => void ) & ( ( ) => void );
	reject: < E extends Error >( err: E ) => void;
	promise: Promise< void >;
}

/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export function defer< T >( ): Deferred< T >;
export function defer( v: void ): EmptyDeferred;

export function defer< T = void >( ): Deferred< T >
{
	const deferred = < Deferred< T > >{ };
	deferred.promise = new Promise< T >( ( resolve, reject ) =>
	{
		deferred.resolve = resolve;
		deferred.reject = reject;
	} );

	/* istanbul ignore next */
	if (
		typeof process !== 'undefined' &&
		process?.env?.JEST_WORKER_ID !== undefined
	)
		try
		{
			// Jest has decided for many versions to break async catching,
			// so this is needed for unit tests not to break unnecessarily.
			deferred.promise.catch( ( ) => { } );
		} catch ( _err ) { }

	return deferred;
}


export interface ResolvedReflection< T >
{
	error?: undefined;
	value: T;
	isResolved: true;
	isRejected: false;
}
export interface RejectedReflection
{
	error: Error;
	value?: undefined;
	isResolved: false;
	isRejected: true;
}

export type Reflection< T > = ResolvedReflection< T > | RejectedReflection;

export function reflect< T >( promise: Promise< T > )
: Promise< Reflection< T > >
{
	const inspection = inspect( promise );

	function handleResolution( value: T ): ResolvedReflection< T >
	{
		return {
			isRejected: false,
			isResolved: true,
			value,
		};
	}

	function handleRejection( error: Error ): RejectedReflection
	{
		return {
			error,
			isRejected: true,
			isResolved: false,
		};
	}

	return inspection.promise
	.then( handleResolution, handleRejection );
}


export interface InspectablePromise< T >
{
	promise: Promise< T >;
	isResolved: boolean;
	isRejected: boolean;
	isPending: boolean;
}
export function inspect< T >( promise: Promise< T > ): InspectablePromise< T >
{
	const inspectable: InspectablePromise< T > = {
		isPending: true,
		isRejected: false,
		isResolved: false,
		promise: < any >void 0,
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


export type DeferredInspectable< T > =
	InspectablePromise< T > & Deferred< T >;
export type EmptyDeferredInspectable =
	InspectablePromise< void > & EmptyDeferred;

/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export function deferInspectable< T >( ): DeferredInspectable< T >;
export function deferInspectable( v: void ): EmptyDeferredInspectable;

export function deferInspectable< T = void >( ): DeferredInspectable< T >
{
	const deferred = defer< T >( );

	const ret: DeferredInspectable< T > = {
		isPending: true,
		isRejected: false,
		isResolved: false,
		promise: deferred.promise,
		resolve( t: T | PromiseLike< T > )
		{
			if ( !ret.isPending )
				return;

			deferred.resolve( t );
			ret.isPending = false;
			ret.isRejected = false;
			ret.isResolved = true;
		},
		reject( err: Error )
		{
			if ( !ret.isPending )
				return;

			deferred.reject( err );
			ret.isPending = false;
			ret.isRejected = true;
			ret.isResolved = false;
		},
	};

	return ret;
}


export type ErrorFilterFunction = ( err: Error ) => boolean;
export interface ErrorFilterObject
{
	[ key: string ]: any;
}

export type CatchFilter =
	ErrorConstructor |
	ErrorFilterFunction |
	ErrorFilterObject;

// This logic is taken from Bluebird
function catchFilter(
	filters: CatchFilter | ConcatArray< CatchFilter > | null,
	err: Error
)
: boolean
{
	return ( Array.isArray( filters ) ? filters : [ filters ] )
	.some( ( filter: CatchFilter | null ) =>
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
				if ( obj[ key ] !== ( < any >err )[ key ] )
					return false;
			return true;
		}

		return false;
	} );
}

export function specific< T, U extends Promise< T > >(
	filters: CatchFilter | ConcatArray< CatchFilter > | null,
	handler: ( err: Error ) => U
)
: ( err: Error ) => ( U );

export function specific< T >(
	filters: CatchFilter | ConcatArray< CatchFilter > | null,
	handler: ( err: Error ) => T
)
: ( err: Error ) => ( T | Promise< T > );

export function specific< T >(
	filters: CatchFilter | ConcatArray< CatchFilter > | null,
	handler: ( err: Error ) => T
)
: ( err: Error ) => ( T | Promise< T > )
{
	return ( err: Error ) =>
	{
		if ( !catchFilter( filters, err ) )
			throw err;

		return handler( err );
	};
}


export function rethrow< T extends Error = any >(
	fn: ( err?: T ) => ( void | PromiseLike< void > )
)
{
	return async ( err: T ) =>
	{
		await fn( err );
		throw err;
	};
}

export interface NotTimedOutValue< T >
{
	timedout: false;
	reflection: Reflection< T >;
	promise: Promise< T >;
}

export interface TimedOutValue< T >
{
	timedout: true;
	reflection: undefined;
	promise: Promise< T >;
}

/**
 * A TimeoutValue contains:
 *   * A boolean whether the promise timed out
 *   * The synchronous value or error of a resolved or rejected promise (if
 *     not timed out)
 *   * The promise itself to further await if timed out.
 */
export type TimeoutValue< T > = NotTimedOutValue< T > | TimedOutValue< T >;

/**
 * Timeout a promise with a certain number of milliseconds.
 *
 * Returns a promise (that will never be rejected) being resolved within _at
 * least_ the timeout duration. The returned value contains the promise
 * value or error, unless timeout was reached.
 *
 * @param promise The promise to await for at most <timeout> ms
 * @param timeout Milliseconds to wait at most before timing out
 * @returns A promise to a {@link TimeoutValue} object
 */
export async function timeout< T >( promise: Promise< T >, timeout: number )
: Promise< TimeoutValue< T > >
{
	const sentry = Symbol();

	return Promise.race( [ reflect( promise ), delay( timeout, sentry ) ] )
	.then( ( value ): TimeoutValue< T > =>
	{
		if ( value === sentry )
		{
			// Timed out
			return { timedout: true, promise, reflection: undefined };
		}
		else
		{
			// Did not time out, the value is the resolved reflection
			return { timedout: false, promise, reflection: value };
		}
	} );
}

export function wrapFunction< R extends void >(
	wrap: ( ) => ( ) => R
): (
	< U extends void, V extends Promise< U > | U >( cb: ( ) => V ) => V
) & (
	< U extends any, V extends Promise< U > | U >( cb: ( ) => V ) => V
);
export function wrapFunction< T extends { }, R extends void >(
	wrap: ( t: T ) => ( ) => R
): (
	< U extends void, V extends Promise< U > | U >( t: T, cb: ( ) => V ) => V
) & (
	< U extends any, V extends Promise< U > | U >( t: T, cb: ( ) => V ) => V
);
export function wrapFunction< R extends void >(
	wrap: ( ) => Promise< ( ) => R >
): (
	< U extends void, V extends Promise< U > | U >( cb: ( ) => V ) =>
		Promise< U >
) & (
	< U extends any, V extends Promise< U > | U >( cb: ( ) => V ) =>
		Promise< U >
);
export function wrapFunction< T, R extends void >(
	wrap: ( t: T ) => Promise< ( ) => R >
): (
	< U extends void, V extends Promise< U > | U >( t: T, cb: ( ) => V ) =>
		Promise< U >
) & (
	< U extends any, V extends Promise< U > | U >( t: T, cb: ( ) => V ) =>
		Promise< U >
);
export function wrapFunction< R extends Promise< void > >(
	wrap: ( ) => ( ( ) => R ) | Promise< ( ) => R >
): < U, V extends Promise< U > | U >( cb: ( ) => V ) => Promise< U >;
export function wrapFunction< T, R extends Promise< void > >(
	wrap: ( t: T ) => ( ( ) => R ) | Promise< ( ) => R >
): < U, V extends Promise< U > | U >( t: T, cb: ( ) => V ) => Promise< U >;

export function wrapFunction< T, R extends Promise< void > | void >(
	wrap:
		( ( t: T ) => ( ( ) => R ) | Promise< ( ) => R > ) |
		( ( ) => ( ( ) => R ) | Promise< ( ) => R > )
):
	( < U, V extends Promise< U > | U >( t: T, cb: ( ) => V ) => any )
	|
	(
		< U, V extends Promise< U > | U >( cb: ( ) => V ) =>
			Promise< U > | U | V
	)
{
	// tslint:disable-next-line
	return function< U, V extends Promise< U > | U >(
		t: T | ( ( ) => U ), cb: ( ) => V
	)
	: Promise< U > | U | V
	{
		if ( arguments.length === 1 ) {
			if ( wrap.length > 0 )
				throw new EvalError(
					"Invalid invocation, function requires 2 arguments"
				);

			cb = < ( ) => V >t;
			t = < T >( < any >void 0 );
		}

		const anyCleanup = (<( t: T ) => any>wrap)( < T >t );

		const callCleanup = < W >( cleanup?: ( ) => W ) =>
		{
			if ( typeof cleanup === "function" )
				return cleanup( );
			else if ( cleanup != null )
				// Allow 'before' to just return null/undefined, but non-empty
				// value would've been silently ignored.
				throw new EvalError(
					"Invalid return value in 'before' handler"
				);
		};

		if (
			anyCleanup &&
			typeof ( < Promise< ( ( ) => R ) > >anyCleanup ).then === "function"
		)
		{
			let doCleanup: ( ) => void;
			return < Promise< U > >( < Promise< ( ( ) => R ) > >anyCleanup )
				.then( async cleanup =>
				{
					doCleanup = ( ) => callCleanup( cleanup );

					return cb( );
				} )
				.finally( ( ) =>
				{
					if ( doCleanup )
						return doCleanup( );
				} );
		} else {
			const cleanup = < ( ) => R >anyCleanup;
			let cbRet: V;

			try
			{
				cbRet = cb( );
			}
			catch ( err )
			{
				const cleanupRet = callCleanup( cleanup );

				if (
					cleanupRet &&
					typeof ( < Promise< void > >cleanupRet ).then === "function"
				)
				{
					return < Promise< U > >( < Promise< void > >cleanupRet )
						.then( ( ) => { throw err; } );
				}
				else
				{
					throw err;
				}
			}

			if (
				cbRet &&
				typeof ( cbRet as Promise< U > | U as Promise< U > ).then
					=== "function"
			)
			{
				return < Promise< U > >(
					cbRet as Promise< U > | U as Promise< U >
				)
					.finally( ( ) => callCleanup( cleanup ) );
			}
			else
			{
				const cleanupRet = callCleanup( cleanup );
				if (
					cleanupRet &&
					typeof ( < Promise< void > >cleanupRet ).then === "function"
				)
				{
					return < Promise< U > >( < Promise< void > >cleanupRet )
						.then( ( ) => cbRet );
				}
				else
				{
					return cbRet;
				}
			}
		}
	};
}


export type FunnelShouldRetry = ( ) => boolean;
export type FunnelRetry< T > = ( ) => Promise< T >;
export type FunnelShortcut = ( ) => void;

export type FunnelFunction< T > =
	(
		shouldRetry: FunnelShouldRetry,
		retry: FunnelRetry< T >,
		shortcut: FunnelShortcut
	) => Promise< T >;

export type Funnel< T > =
	( funnelFunction: FunnelFunction< T > ) => Promise< T >;

export interface FunnelOptions
{
	onEmpty: ( ) => void;
	concurrency: number;
}

export function funnel< T >( opts: Partial< FunnelOptions > = { } )
: Funnel< T >
{
	type U = Promise< T >;

	const { onEmpty, concurrency = 1 } = ( opts || { } );

	enum FunnelState
	{
		DEFAULT,
		SHOULD_RETRY,
		WAITING,
		COMPLETED,
	}

	interface FunnelStore
	{
		state: FunnelState;
		counted: boolean;
		resume: undefined | ( ( ) => void );
	}

	/**
	 * All ongoing tasks (functions) regardless of state they are in.
	 * If they return/throw or shortcut, they get cleared from this map.
	 * The order is preserved for fifo fairness.
	 */
	const tasks = new Map< { }, FunnelStore >( );

	const countWaiting = ( ) =>
	{
		return [ ...tasks.values( ) ]
			.filter( ( { state } ) => state === FunnelState.WAITING )
			.length;
	};

	const countWorking = ( ) =>
	{
		return [ ...tasks.values( ) ]
			.filter( ( { state } ) => state === FunnelState.SHOULD_RETRY )
			.length;
	};

	const freeSlots = ( ) =>
	{
		return Math.max( 0, concurrency - countWorking( ) );
	};

	const triggerWaiting = ( ) =>
	{
		const amountToResume = freeSlots( );

		[ ...tasks.values( ) ]
			.filter( ( { state } ) => state === FunnelState.WAITING )
			.slice( 0, amountToResume )
			.forEach( task =>
			{
				( task.resume as NonNullable< typeof task.resume > )( );
			} );
	};

	return ( fn: FunnelFunction< T > ): U =>
	{
		const sentry = { };
		const store: FunnelStore = {
			state: FunnelState.DEFAULT,
			counted: false,
			resume: undefined,
		};
		tasks.set( sentry, store );

		const shouldRetry: FunnelShouldRetry = ( ) =>
		{
			if ( store.state === FunnelState.COMPLETED )
				// shortcut before should/retry shortcuts through
				return false;

			const free = freeSlots( );
			const shouldContinue = free > 0;

			if ( store.state !== FunnelState.DEFAULT )
				throw new Error( "Invalid use of 'shouldRetry'" );

			store.state = FunnelState.SHOULD_RETRY;
			store.counted = true;

			return !shouldContinue;
		};

		const retry: FunnelRetry< T > = ( ) =>
		{
			if ( store.state !== FunnelState.SHOULD_RETRY )
				throw new Error(
					"Invalid use of 'retry', " +
					"must only be called after 'shouldRetry'"
				);

			store.state = FunnelState.WAITING;

			const deferred = defer< T >( );
			const resume = ( ) =>
			{
				store.state = FunnelState.DEFAULT;
				store.resume = undefined;
				deferred.resolve( runner( ) );
			};

			store.resume = resume;

			return < U >deferred.promise;
		};

		const shortcut = ( ) =>
		{
			if ( store.state === FunnelState.COMPLETED )
				return;

			store.state = FunnelState.COMPLETED;

			tasks.delete( sentry );

			if ( countWaiting( ) === 0 )
				onEmpty?.( );
			else
				triggerWaiting( );
		};

		const runner = ( ) =>
		{
			return (
				< U >( async ( ) => fn( shouldRetry, retry, shortcut ) )( )
			)
			.finally( shortcut );
		};

		return runner( );
	};
}


export class OrderedAsynchrony
{
	private deferrals: Array< EmptyDeferred > = [ ];

	public wait(
		waitForIndex: number | ConcatArray< number >,
		resolveIndex?: number | ConcatArray< number > | undefined | null,
		rejectIndex?: number | ConcatArray< number > | undefined | null
	)
	: Promise< void > & this
	{
		this.ensureDeferral( [
			...( ( < Array< number > >[ ] ).concat( waitForIndex ) ),
			...(
				resolveIndex == null ? [ ] :
				( < Array< number > >[ ] ).concat( resolveIndex )
			),
			...(
				rejectIndex == null ? [ ] :
				( < Array< number > >[ ] ).concat( rejectIndex )
			),
		] );

		return this.decorate(
			Promise.all(
				( < Array< number > >[ ] ).concat( waitForIndex )
				.map( index => this.deferrals[ index ].promise )
			)
			.then( ( ) =>
				Promise.all( [
					resolveIndex == null
						? void 0
						: this.resolve( resolveIndex ),
					rejectIndex == null
						? void 0
						: this.reject( rejectIndex ),
				] )
				.then( ( ) => { } )
			)
		);
	}

	public resolve( index: number | ConcatArray< number > )
	: Promise< void > & this
	{
		this.ensureDeferral( index );

		return this.decorate( delay( 0 ).then( ( ) =>
		{
			( < Array< number > >[ ] ).concat( index )
			.forEach( index =>
			{
				this.deferrals[ index ].resolve( );
			} );
		} ) );
	}

	public reject(
		index: number | ConcatArray< number >,
		error = new Error( "OrderedAsynchrony rejection" )
	)
	: Promise< void > & this
	{
		this.ensureDeferral( index );

		return this.decorate( delay( 0 ).then( ( ) =>
		{
			( < Array< number > >[ ] ).concat( index )
			.forEach( index =>
			{
				this.deferrals[ index ].reject( error );
			} );
		} ) );
	}

	private ensureDeferral( index: number | ConcatArray< number > ): this
	{
		const indices = ( < Array< number > >[ ] )
			.concat( index )
			.sort( ( a, b ) => b - a );

		const highest = indices[ 0 ];

		for ( let i = this.deferrals.length; i <= highest; ++i )
			this.deferrals.push( defer( void 0 ) );

		return this;
	}

	private decorate( promise: Promise< void > )
	: Promise< void > & this
	{
		// tslint:disable-next-line:variable-name
		const This = {
			decorate: this.decorate.bind( this ),
			deferrals: this.deferrals,
			ensureDeferral: this.ensureDeferral.bind( this ),
			reject: this.reject.bind( this ),
			resolve: this.resolve.bind( this ),
			wait: this.wait.bind( this ),
		} as unknown as this;

		return Object.assign(
			promise,
			This
		);
	}
}

export function deferSet( )
{
	return new OrderedAsynchrony( );
}
