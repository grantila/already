import {
	deferSet,
	reflect,
} from "../";


describe( "deferSet", ( ) =>
{
	it.concurrent( "resolve, wait", async ( ) =>
	{
		const order = deferSet( );

		await order.resolve( 0 );
		await order.wait( 0 );
	} );

	it.concurrent( "wait+resolve+reject all-in-one", async ( ) =>
	{
		const order = deferSet( );

		await order.resolve( 0 );

		await order.wait( 0, 1, 2 );

		await order.wait( 1 );
		const reflection = await reflect( order.wait( 2 ) );
		expect( reflection.isRejected ).toBe( true );
		expect( ( < Error >reflection.error ).message ).toMatch( /rejection/ );
	} );

	it.concurrent( "wait+resolve+reject all-in-one, arrays", async ( ) =>
	{
		const order = deferSet( );

		await order.resolve( [ 0, 1 ] );

		await order.wait( [ 0, 1 ], [ 2, 3 ], [ 4, 5 ] );

		await order.wait( [ 2, 3 ] );
		const reflection = await reflect( order.wait( [ 4, 5 ] ) );
		expect( reflection.isRejected ).toBe( true );
		expect( ( < Error >reflection.error ).message ).toMatch( /rejection/ );
	} );

	it.concurrent( "wait+resolve+reject all-in-one, empty arrays", async ( ) =>
	{
		const order = deferSet( );

		await order.wait( [ ], [ ], [ ] );
	} );
} );
