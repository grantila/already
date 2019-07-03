import {
	defer,
	deferSet,
	delay,
	funnel,
	Funnel,
	FunnelFunction,
	reflect,
} from "../";


type AnyFunctionWoArgs< T > =
	( ( ) => T ) |
	( ( ) => Promise< T > );
type AnyFunction< T > =
	AnyFunctionWoArgs< T > |
	( ( arg: any ) => T ) |
	( ( arg: any ) => Promise< T > );

const makePredicate = < T >(
	pre: AnyFunction< void >,
	post: AnyFunction< void >,
	ret: T
)
: FunnelFunction< T > => async ( shouldRetry, retry ) =>
{
	await ( < AnyFunctionWoArgs< T > >pre )( );

	if ( shouldRetry( ) )
		return retry( );

	await ( < AnyFunctionWoArgs< T > >post )( );

	return ret;
};

const maker = (
	reporter: ( val: string ) => void,
	val: string,
	millis: number | ( ( ) => Promise< void > ) = 0
) =>
	async ( ) =>
	{
		if ( typeof millis === "number" || typeof millis === "bigint" )
			await delay( millis );
		else
			await millis( );
		reporter( val );
	};

const testError = ( ) => new Error( "foo" );

describe( "funnel", ( ) =>
{
	[ true, false ].forEach( fifo => describe( `fifo = ${fifo}`, ( ) =>
	{
		it.concurrent( "only one job", async ( ) =>
		{
			const onComplete = jest.fn( );
			const fun: Funnel< number > =
				funnel< number >( { fifo, onComplete } );

			const value = await fun( async ( shouldRetry, retry ) =>
			{
				await delay( 0 );

				if ( shouldRetry( ) )
					return retry( );

				return 4;
			} );

			expect( value ).toBe( 4 );
			await delay( 0 ); // Allow onComplete to settle
			expect( onComplete.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "two jobs", async ( ) =>
		{
			const deferred = defer( void 0 );
			const onComplete = jest.fn( deferred.resolve );
			const parts = jest.fn( );
			const fun = funnel< number >( { fifo, onComplete } );
			const order = deferSet( );

			const eventualValue1 =
				fun( makePredicate< number >(
					maker( parts, "1 a", ( ) => order.wait( 0 ) ),
					maker( parts, "1 b", ( ) => order.wait( 1 ) ),
					1
				) );

			const eventualValue2 =
				fun( makePredicate< number >(
					maker( parts, "2 a", ( ) => order.wait( 0 ) ),
					maker( parts, "2 b", ( ) => order.wait( 1 ) ),
					2
				) );

			order.resolve( 0 )
			.then( ( ) => delay( 10 ) )
			.then( ( ) => order.resolve( 1 ) );

			const value1 = await eventualValue1;
			const value2 = await eventualValue2;
			await deferred.promise;

			const args = ( < Array< string > >[ ] )
				.concat( ...parts.mock.calls );

			expect( value1 ).toBe( 1 );
			expect( value2 ).toBe( 2 );
			expect( args ).toEqual(
				[ "1 a", "2 a", "1 b", "2 a", "2 b" ]
			);
			expect( onComplete.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "two jobs, first slower", async ( ) =>
		{
			const deferred = defer( void 0 );
			const onComplete = jest.fn( deferred.resolve );
			const parts = jest.fn( );
			const fun = funnel< number >( { fifo, onComplete } );
			const order = deferSet( );

			const eventualValue1 =
				fun( makePredicate< number >(
					maker( parts, "1 a", ( ) => order.wait( 0 ).wait( 1 ) ),
					maker( parts, "1 b", ( ) => order.wait( 0 ) ),
					1
				) );

			const eventualValue2 =
				fun( makePredicate< number >(
					maker( parts, "2 a", ( ) => order.resolve( 0 ) ),
					maker( parts, "2 b", ( ) => order.resolve( 0 ) ),
					2
				) );

			await delay( 20 ); order.resolve( 1 );

			const value1 = await eventualValue1;
			const value2 = await eventualValue2;
			await deferred.promise;

			const args = ( < Array< string > >[ ] )
				.concat( ...parts.mock.calls );

			expect( value1 ).toBe( 1 );
			expect( value2 ).toBe( 2 );
			expect( args ).toEqual(
				fifo
				? [ "2 a", "1 a", "1 b", "2 a", "2 b" ]
				: [ "2 a", "2 b", "1 a", "1 b" ]
			);
			expect( onComplete.mock.calls.length ).toBe( 1 );
		} );
	} ) );

	it.concurrent( "two jobs, first slower, no arg", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 1 ) ),
				maker( parts, "1 b", ( ) => order.wait( 2 ) ),
				1
			) );

		const eventualValue2 =
			fun( makePredicate< number >(
				maker( parts, "2 a", ( ) => order.wait( 0 ) ),
				maker( parts, "2 b", ( ) => order.wait( 3 ) ),
				2
			) );

		order.resolve( 0 ); await delay( 1 );
		order.resolve( 1 ); await delay( 1 );
		order.resolve( 2 ); await delay( 1 );
		order.resolve( 3 ); await delay( 1 );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args = ( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual(
			[ "2 a", "1 a", "1 b", "2 a", "2 b" ]
		);
	} );

	it.concurrent( "two jobs, first slower, arg = null", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( < any >null );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 1 ) ),
				maker( parts, "1 b", ( ) => order.wait( 2 ) ),
				1
			) );

		const eventualValue2 =
			fun( makePredicate< number >(
				maker( parts, "2 a", ( ) => order.wait( 0 ) ),
				maker( parts, "2 b", ( ) => order.wait( 3 ) ),
				2
			) );

		order.resolve( 0 ); await delay( 1 );
		order.resolve( 1 ); await delay( 1 );
		order.resolve( 2 ); await delay( 1 );
		order.resolve( 3 ); await delay( 1 );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args = ( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual(
			[ "2 a", "1 a", "1 b", "2 a", "2 b" ]
		);
	} );

	it.concurrent( "two jobs, first slower, onComplete = null", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( { onComplete: < any >null } );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 1 ) ),
				maker( parts, "1 b", ( ) => order.wait( 2 ) ),
				1
			) );

		const eventualValue2 =
			fun( makePredicate< number >(
				maker( parts, "2 a", ( ) => order.wait( 0 ) ),
				maker( parts, "2 b", ( ) => order.wait( 3 ) ),
				2
			) );

		order.resolve( 0 ); await delay( 1 );
		order.resolve( 1 ); await delay( 1 );
		order.resolve( 2 ); await delay( 1 );
		order.resolve( 3 ); await delay( 1 );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args = ( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual(
			[ "2 a", "1 a", "1 b", "2 a", "2 b" ]
		);
	} );

	it.concurrent( "two jobs, shortcut", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( { onComplete: < any >null, fifo: false } );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 0 ) ),
				maker( parts, "1 b", ( ) => order.wait( 0 ).resolve( 1 ) ),
				1
			) );

		const eventualValue2 =
			fun( async ( shouldRetry, retry, shortcut ) =>
			{
				parts( "2 a" );

				await order.resolve( 0 );

				if ( shouldRetry( ) )
					return retry( );

				parts( "2 b" );
				shortcut( );
				await order.wait( 1 );
				parts( "2 c" );

				return 2;
			} );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args = ( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual( [ "2 a", "2 b", "1 a", "1 b", "2 c" ] );
	} );

	it.concurrent( "two jobs, shortcut before retry", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( { onComplete: < any >null, fifo: false } );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 0 ) ),
				maker( parts, "1 b", 0 ),
				1
			) );

		const eventualValue2 =
			fun( async ( shouldRetry, retry, shortcut ) =>
			{
				await delay( 1 );
				parts( "2 a" );

				shortcut( );

				if ( shouldRetry( ) )
					return retry( );

				parts( "2 b" );
				await delay( 1 );
				parts( "2 c" );

				order.resolve( 0 );

				return 2;
			} );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args = ( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual( [ "2 a", "2 b", "2 c", "1 a", "1 b" ] );
	} );

	it.concurrent( "two jobs, retry in sync", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( { onComplete: < any >null, fifo: false } );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 0 ) ),
				maker( parts, "1 b", 0 ),
				1
			) );

		const eventualValue2 =
			fun( async ( shouldRetry, retry, shortcut ) =>
			{
				if ( shouldRetry( ) )
					return retry( );

				parts( "2 a" );
				order.resolve( 0 );

				return 2;
			} );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args = ( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual( [ "2 a", "1 a", "1 b" ] );
	} );

	describe( "exceptions", ( ) =>
	{
		const throwFun = ( ) => { throw testError( ); };
		const rejectFun = async ( ) => { throw testError( ); };

		const runs = [
			{ name: "sync", type: "throw", predicate: throwFun },
			{ name: "async", type: "reject", predicate: rejectFun },
		];

		runs.forEach( ( { type, name, predicate } ) =>
		{
			it.concurrent( `should be able to ${type} before shouldRetry (${name})`,
				async ( ) =>
			{
				const fun = funnel< number >( );

				const thrower = async ( ) =>
					reflect(
						fun( makePredicate< number >(
							predicate,
							( ) => { },
							42
						) )
					);

				const reflection = await thrower( );
				expect( reflection.isRejected ).toBe( true );
				expect( ( < Error >reflection.error ).message )
					.toBe( "foo" );
			} );

			it.concurrent( `should be able to ${type} after shouldRetry (${name})`,
				async ( ) =>
			{
				const fun = funnel< number >( );

				const thrower = async ( ) =>
					reflect(
						fun( makePredicate< number >(
							( ) => { },
							predicate,
							42
						) )
					);

				const reflection = await thrower( );
				expect( reflection.isRejected ).toBe( true );
				expect( ( < Error >reflection.error ).message )
					.toBe( "foo" );
			} );
		} );
	} );
} );
