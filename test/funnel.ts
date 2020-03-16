import {
	defer,
	deferSet,
	delay,
	funnel,
	Funnel,
	FunnelFunction,
	FunnelRetry,
	FunnelShortcut,
	reflect,
} from "../";


const makePredicate = < T >(
	pre: FunnelFunction< T >,
	post: FunnelFunction< T >,
	ret: T
)
: FunnelFunction< T > => async ( shouldRetry, retry, shortcut ) =>
{
	await ( pre )( shouldRetry, retry, shortcut );

	if ( shouldRetry( ) )
		return retry( );

	await ( post )( shouldRetry, retry, shortcut );

	return ret;
};

interface MakerArguments
{
	shortcut: FunnelShortcut;
	retry: FunnelRetry< any >;
	shouldRetry: FunnelShortcut;
}

const maker = (
	reporter: ( val: string ) => void,
	val: string,
	millis: number | ( ( args: MakerArguments ) => Promise< void > ) = 0
): FunnelFunction< number > =>
	async ( shouldRetry, retry, shortcut ) =>
	{
		if ( typeof millis === "number" )
			await delay( millis );
		else
			await millis( { shouldRetry, retry, shortcut } );
		reporter( val );
		return 0;
	};

const testError = ( ) => new Error( "foo" );

describe( "funnel", ( ) =>
{
	it.concurrent( "double shouldRetry", async ( ) =>
	{
		const fun: Funnel< number > = funnel< number >( );

		const value = ( ) => fun( async ( shouldRetry, retry ) =>
		{
			shouldRetry( );
			if ( shouldRetry( ) )
				return retry( );
			return 4;
		} );

		await expect( value( ) ).rejects.toThrow( /shouldRetry/ );
	} );

	it.concurrent( "retry without shouldRetry", async ( ) =>
	{
		const fun: Funnel< number > = funnel< number >( );

		const value = ( ) => fun( async ( shouldRetry, retry ) =>
		{
			return retry( );
		} );

		await expect( value( ) ).rejects.toThrow( /retry/ );
	} );

	it.concurrent( "only one job", async ( ) =>
	{
		const onEmpty = jest.fn( );
		const fun: Funnel< number > = funnel< number >( { onEmpty } );

		const value = await fun( async ( shouldRetry, retry ) =>
		{
			await delay( 0 );

			if ( shouldRetry( ) )
				return retry( );

			return 4;
		} );

		expect( value ).toBe( 4 );
		await delay( 0 ); // Allow onEmpty to settle
		expect( onEmpty.mock.calls.length ).toBe( 1 );
	} );

	it.concurrent( "two jobs", async ( ) =>
	{
		const deferred = defer( void 0 );
		const onEmpty = jest.fn( deferred.resolve );
		const parts = jest.fn( );
		const fun = funnel< number >( { onEmpty } );
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
		expect( onEmpty.mock.calls.length ).toBe( 1 );
	} );

	it.concurrent( "two jobs, first slower", async ( ) =>
	{
		const deferred = defer( void 0 );
		const onEmpty = jest.fn( deferred.resolve );
		const parts = jest.fn( );
		const fun = funnel< number >( { onEmpty } );
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
		expect( args ).toEqual( [ "2 a", "2 b", "1 a", "1 b" ] );
		expect( onEmpty.mock.calls.length ).toBe( 2 );
	} );

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
		expect( args ).toEqual( [ "2 a", "1 a", "2 b", "1 a", "1 b" ] );
	} );

	it.concurrent( "two jobs, first slower (concurrency = 2)", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( { concurrency: 2 } );
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
		expect( args ).toEqual( [ "2 a", "1 a", "1 b", "2 b" ] );
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
		expect( args ).toEqual( [ "2 a", "1 a", "2 b", "1 a", "1 b" ] );
	} );

	it.concurrent( "two jobs, first slower, onEmpty = undefined", async ( ) =>
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
		expect( args ).toEqual( [ "2 a", "1 a", "2 b", "1 a", "1 b" ] );
	} );

	it.concurrent( `two jobs, shortcut before retry`,
		async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 0 ) ),
				maker( parts, "1 b", async ( { shortcut } ) =>
					{
						shortcut( );
						await order.resolve( 1 );
					} ),
				1
			) );

		const eventualValue2 =
			fun( async ( shouldRetry, retry, shortcut ) =>
			{
				await delay( 1 );
				parts( "2 a" );

				shortcut( );
				await order.resolve( 0 );
				await order.wait( 1 );

				if ( shouldRetry( ) )
					return retry( );

				parts( "2 b" );
				await delay( 1 );
				parts( "2 c" );

				return 2;
			} );

		const value1 = await eventualValue1;
		const value2 = await eventualValue2;

		const args =
			( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual( [ "2 a", "1 a", "1 b", "2 b", "2 c" ] );
	} );

	it.concurrent( `two jobs, shortcut after retry`,
		async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( );
		const order = deferSet( );

		const eventualValue1 =
			fun( makePredicate< number >(
				maker( parts, "1 a", ( ) => order.wait( 0 ) ),
				maker( parts, "1 c", async ( { shortcut } ) =>
					{
						parts( "1 b" );
						shortcut( );
						await order.resolve( 1 );
						await order.wait( 2 );
					} ),
				1
			) );

		const eventualValue2 =
			fun( async ( shouldRetry, retry, shortcut ) =>
			{
				parts( "2 a" );

				await order.resolve( 0 );
				await order.wait( 1 );

				if ( shouldRetry( ) )
					return retry( );

				parts( "2 b" );
				await order.resolve( 2 );
				await order.wait( 3 );
				parts( "2 c" );

				return 2;
			} );

		const value1 = await eventualValue1;
		order.resolve( 3 );
		const value2 = await eventualValue2;

		const args =
			( < Array< string > >[ ] ).concat( ...parts.mock.calls );

		expect( value1 ).toBe( 1 );
		expect( value2 ).toBe( 2 );
		expect( args ).toEqual( [ "2 a", "1 a", "1 b", "2 b", "1 c", "2 c" ] );
	} );

	it.concurrent( "two jobs, retry in sync", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( );
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
							async ( ) => 0,
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
							async ( ) => 0,
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

	it( "flow through in parallel", async ( ) =>
	{
		const parts = jest.fn( );
		const fun = funnel< number >( );

		const deferred1 = defer( undefined );
		const deferred2 = defer( undefined );
		const deferred3 = defer( undefined );

		const firstSlow =
			fun( async ( shouldRetry, retry ) => {
				if ( shouldRetry( ) )
					return retry( );

				parts( 1, "before" );
				await deferred1.promise;
				parts( 1, "after" );
				return 1;
			} );

		const next1 = fun( async ( shouldRetry, retry, shortcut ) =>
			{
				if ( shouldRetry( ) )
					return retry( );

				parts( 2, "before" );
				shortcut( );
				await deferred2.promise;
				parts( 2, "after" );
				return 2;
			} );

		const next2 = fun( async ( shouldRetry, retry, shortcut ) =>
			{
				if ( shouldRetry( ) )
					return retry( );

				parts( 3, "before" );
				shortcut( );
				await deferred3.promise;
				parts( 3, "after" );
				return 3;
			} );

		expect( parts.mock.calls ).toEqual( [
			[ 1, "before" ],
		] );
		deferred1.resolve( );
		expect( await firstSlow ).toEqual( 1 );

		await delay( 1 );
		expect( parts.mock.calls ).toEqual( [
			[ 1, "before" ],
			[ 1, "after" ],
			[ 2, "before" ],
			[ 3, "before" ],
		] );

		deferred2.resolve( );
		expect( await next1 ).toEqual( 2 );
		expect( parts.mock.calls ).toEqual( [
			[ 1, "before" ],
			[ 1, "after" ],
			[ 2, "before" ],
			[ 3, "before" ],
			[ 2, "after" ],
		] );

		deferred3.resolve( );
		expect( await next2 ).toEqual( 3 );
		expect( parts.mock.calls ).toEqual( [
			[ 1, "before" ],
			[ 1, "after" ],
			[ 2, "before" ],
			[ 3, "before" ],
			[ 2, "after" ],
			[ 3, "after" ],
		] );
	} );
} );
