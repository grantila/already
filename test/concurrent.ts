import {
	concurrent,
	defer,
	Deferred,
	delay,
	reflect,
} from "../";

const fooError = "foo error";
const testError = new Error( fooError );

interface Predicate< T >
{
	resolve: Deferred< T >[ 'resolve' ];
	reject: Deferred< T >[ 'reject' ];
	called: boolean;
	fn: ( ) => Promise< T >;
}

interface Concurrencies
{
	values: Array< number >;
	cur: number;
	inc: ( ) => void;
	dec: ( ) => void;
}

function makeConcurrencies( ): Concurrencies
{
	const concurrencies: Concurrencies = {
		values: [ ],
		cur: 0,
		inc( )
		{
			concurrencies.values.push( ++concurrencies.cur );
		},
		dec( )
		{
			concurrencies.values.push( --concurrencies.cur );
		},
	};
	return concurrencies;
}

function makePredicate< T = void >(
	concurrencies: Concurrencies,
	_index: number
)
{
	const deferred = defer< T >( );

	const pred: Predicate< T > = {
		resolve: deferred.resolve,
		reject: deferred.reject,
		called: false,
		async fn( )
		{
			concurrencies.inc( );
			pred.called = true;
			const ret = await reflect( deferred.promise as Promise< T > );
			concurrencies.dec( );

			if ( ret.error )
				throw ret.error;
			return ret.value as T;
		},
	};

	return pred;
}

function makePredicates< T = void >( amount: number )
{
	const concurrencies = makeConcurrencies( );
	const preds = Array.from( Array( amount ) )
		.map( ( _, index ) => makePredicate< T >( concurrencies, index ) );

	return { preds, concurrencies };
}


describe( "concurrent", ( ) =>
{
	it.concurrent( "should handle queue in order (conc = 0)", async ( ) =>
	{
		expect( ( ) => concurrent( 0 ) ).toThrowError( /at least/ );
	} );

	it.concurrent( "should handle queue in order (conc = 1)", async ( ) =>
	{
		const concurrently = concurrent( 1 );

		const { preds, concurrencies } = makePredicates( 5 );

		const res = preds.map( pred => concurrently( pred.fn ) );

		// Allow potential async awaits to settle
		await delay( 1 );

		expect( concurrencies.values )
			.toStrictEqual( [ 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, false, false, false, false ] );

		preds[ 0 ].resolve( ); await res[ 0 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 0, 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, false, false, false ] );

		preds[ 1 ].resolve( ); await res[ 1 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 0, 1, 0, 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, false, false ] );

		preds[ 2 ].resolve( ); await res[ 2 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 0, 1, 0, 1, 0, 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, false ] );

		preds[ 3 ].resolve( ); await res[ 3 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 0, 1, 0, 1, 0, 1, 0, 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 4 ].resolve( ); await res[ 4 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ] );
	} );

	it.concurrent( "should handle queue in order (conc = 3)", async ( ) =>
	{
		const concurrently = concurrent( 3 );

		const { preds, concurrencies } = makePredicates( 5 );

		const res = preds.map( pred => concurrently( pred.fn ) );

		// Allow potential async awaits to settle
		await delay( 1 );

		expect( concurrencies.values ).toStrictEqual( [ 1, 2, 3 ] );

		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, false, false ] );

		preds[ 0 ].resolve( ); await res[ 0 ];

		expect( concurrencies.values ).toStrictEqual( [ 1, 2, 3, 2, 3 ] );

		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, false ] );

		preds[ 1 ].resolve( ); await res[ 1 ];

		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3 ] );

		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 2 ].resolve( ); await res[ 2 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2 ] );

		preds[ 3 ].resolve( ); await res[ 3 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1 ] );

		preds[ 4 ].resolve( ); await res[ 4 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1, 0 ] );
	} );

	it.concurrent( "should handle queue out-of-order (conc = 3)", async ( ) =>
	{
		const concurrently = concurrent( 3 );

		const { preds, concurrencies } = makePredicates( 5 );

		const res = preds.map( pred => concurrently( pred.fn ) );

		// Allow potential async awaits to settle
		await delay( 1 );

		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3 ] );

		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, false, false ] );

		preds[ 0 ].resolve( ); await res[ 0 ];

		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3 ] );

		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, false ] );

		preds[ 2 ].resolve( ); await res[ 2 ];

		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3 ] );

		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 1 ].resolve( ); await res[ 1 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2 ] );

		preds[ 3 ].resolve( ); await res[ 3 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1 ] );

		preds[ 4 ].resolve( ); await res[ 4 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1, 0 ] );
	} );

	it.concurrent( "should handle queue out-of-order (conc = 3), direct",
		async ( ) =>
	{
		const { preds, concurrencies } = makePredicates( 5 );

		const concurrently = concurrent( 3, async ( n: number ) => preds[ n ].fn( ) );

		expect( concurrencies.values )
			.toStrictEqual( [ ] );

		const res = preds.map( ( _, i ) => concurrently( i ) );

		await delay( 1 );

		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, false, false ] );

		preds[ 1 ].resolve( ); await res[ 1 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, false ] );

		preds[ 3 ].resolve( ); await res[ 3 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 0 ].resolve( ); await res[ 0 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 2 ].resolve( ); await res[ 2 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 4 ].resolve( ); await res[ 4 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1, 0 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );
	} );

	it.concurrent(
		"should handle queue out-of-order (conc = 3), direct with data/error",
		async ( ) =>
	{
		const { preds, concurrencies } = makePredicates< string >( 5 );

		const concurrently = concurrent(
			3,
			async ( n: number ) => preds[ n ].fn( )
		);

		expect( concurrencies.values )
			.toStrictEqual( [ ] );

		const res = preds.map( ( _, i ) => concurrently( i ) );

		const data: Array< any > = [ 0, 0, 0, 0, 0 ];

		await delay( 1 );

		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, false, false ] );

		preds[ 1 ].resolve( "a" ); data[ 1 ] = await res[ 1 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, false ] );

		preds[ 3 ].reject( testError );
		data[ 3 ] = ( await reflect( res[ 3 ] ) ).error;
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 0 ].resolve( "c" ); data[ 0 ] = await res[ 0 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 2 ].resolve( "d" ); data[ 2 ] = await res[ 2 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		preds[ 4 ].resolve( "e" ); data[ 4 ] = await res[ 4 ];
		expect( concurrencies.values )
			.toStrictEqual( [ 1, 2, 3, 2, 3, 2, 3, 2, 1, 0 ] );
		expect( preds.map( ( { called } ) => called ) )
			.toStrictEqual( [ true, true, true, true, true ] );

		expect( data ).toStrictEqual( [ "c", "a", "d", testError, "e" ] );
	} );
} );
