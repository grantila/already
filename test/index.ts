import {
	defer,
	deferInspectable,
	delay,
	delayChain,
	each,
	filter,
	inspect,
	map,
	once,
	props,
	reduce,
	reflect,
	rethrow,
	retry,
	some,
	specific,
	tap,
	Try,
	wrapFunction,
} from "../";

const fooError = "foo error";
const testError = new Error( fooError );
const fooValue = 4711;
const barValue = 17;


describe( "tap", ( ) =>
{
	it.concurrent( "should be called on a resolved promise", ( ) =>
	{
		let called = false;

		return Promise.resolve( fooValue )
		.then( tap( num =>
		{
			if ( num !== fooValue )
				throw new Error( "tap lost data before callback" );
			called = true;
		} ) )
		.then( num =>
		{
			if ( num !== fooValue )
				throw new Error( "tap lost data after callback" );
			if ( !called )
				throw new Error( "Finally callback not called!" );
		} );
	} );

	it.concurrent( "should not be called on a rejected promise", ( ) =>
	{
		let called = false;

		return Promise.reject( new Error( fooError ) )
		.then( tap( ( ) =>
		{
			called = true;
		} ) )
		.catch( err =>
		{
			if ( called )
				throw new Error( "tap callback shouldn't have been called" );
			throw err;
		} )
		.then( ( ) =>
		{
			if ( called )
				throw new Error( "tap callback shouldn't have been called" );
		} )
		.catch( err =>
		{
			if ( err.message !== fooError )
				throw err;
		} );
	} );
} );


describe( "props", ( ) =>
{
	it.concurrent( "should work as standalone call", async ( ) =>
	{
		const val = await props( { a: 1, b: delay( 10 ).then( ( ) => 2 ) } );

		expect( val ).toEqual( { a: 1, b: 2 } );
	} );

	it.concurrent( "should work in a promise chain as function reference",
		async ( ) =>
	{
		const val = await
			Promise.resolve( { a: 1, b: delay( 10 ).then( ( ) => 2 ) } )
			.then( props );

		expect( val ).toEqual( { a: 1, b: 2 } );
	} );
} );


describe( "filter", ( ) =>
{
	function filterConcurrency< T >(
		concurrency: number,
		values: Array< T >,
		filter_: ( ( t: T ) => ( boolean | PromiseLike< boolean > ) )
	)
	: Promise< { concurrencies: Array< number >; values: Array< T >; } >
	{
		let concur = 0;
		const concurrencies: Array< number > = [ ];

		return Promise.resolve( values )
		.then( filter( { concurrency }, ( val: T, index: number ) =>
			Promise.resolve( val )
			.then( tap( ( ) =>
			{
				concurrencies.push( ++concur );
				return Promise.resolve( )
				.then( delayChain( index * 4 ) );
			} ) )
			.then( ( ) => filter_( val ) )
			.then( tap( ( ) => { concurrencies.push( --concur ); } ) )
		) )
		.then( values => ( { values, concurrencies } ) );
	}

	it.concurrent( "unspecified concurrency should be correct", async ( ) =>
	{
		const { concurrencies, values } = await filterConcurrency(
			< number >< any >void 0,
			[ 1, 2, 3, 4, 5 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).toEqual( [ 2, 4 ] );
		expect( concurrencies ).toEqual( [ 1, 2, 3, 4, 5, 4, 3, 2, 1, 0 ] );
	} );

	it.concurrent( "concurrency 1 should be correct", async ( ) =>
	{
		const { concurrencies, values } = await filterConcurrency(
			1,
			[ 1, 2, 3, 4, 5 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).toEqual( [ 2, 4 ] );
		expect( concurrencies ).toEqual( [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ] );
	} );

	it.concurrent( "concurrency 2 should be correct", async ( ) =>
	{
		const { concurrencies, values } = await filterConcurrency(
			2,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).toEqual( [ 2, 4, 6, 8 ] );
		const last = concurrencies.pop( );
		expect( last ).toBe( 0 );
		expect( concurrencies ).not.toContain( 0 );
		expect( concurrencies ).toContain( 2 );
	} );

	it.concurrent( "concurrency 3 should be correct", async ( ) =>
	{
		const { concurrencies, values } = await filterConcurrency(
			3,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).toEqual( [ 2, 4, 6, 8 ] );
		const last = concurrencies.pop( );
		expect( last ).toBe( 0 );
		expect( concurrencies ).not.toContain( 0 );
		expect( concurrencies ).toContain( 3 );
	} );

	it.concurrent( "should work without options", async ( ) =>
	{
		const arr = [ 1, 2, Promise.resolve( 3 ), delayChain( 50 )( 4 ), 5 ];
		const arr2 = await Promise.all( arr )
		.then( filter(
			( t: number ) =>
				t < 4
				? delay( 50 ).then( ( ) => t % 2 === 0 )
				: t % 2 === 0
		) );

		expect( arr2 ).toEqual( [ 2, 4 ] );
	} );

	it.concurrent( "should work as a free function", async ( ) =>
	{
		const arr = [ 1, 2, Promise.resolve( 3 ), delayChain( 50 )( 4 ), 5 ];
		const arr2 = await filter(
			arr,
			{ concurrency: 10 },
			t =>
				t < 4
				? delay( 50 ).then( ( ) => t % 2 === 0 )
				: t % 2 === 0
		);

		expect( arr2 ).toEqual( [ 2, 4 ] );
	} );

	it.concurrent( "should work as a free function without options",
		async ( ) =>
	{
		const arr = [ 1, 2, Promise.resolve( 3 ), delayChain( 50 )( 4 ), 5 ];
		const arr2 = await filter(
			arr,
			t =>
				t < 4
				? delay( 50 ).then( ( ) => t % 2 === 0 )
				: t % 2 === 0
		);

		expect( arr2 ).toEqual( [ 2, 4 ] );
	} );
} );


describe( "map", ( ) =>
{
	function mapConcurrency< T, U >(
		concurrency: number,
		values: Array< T >,
		map_: ( t: T ) => U
	)
	: Promise< { concurrencies: Array< number >; values: Array< U >; } >
	{
		let concur = 0;
		const concurrencies: Array< number > = [ ];

		return Promise.resolve( values )
		.then( map( { concurrency }, ( val: T, index: number ) =>
			Promise.resolve( val )
			.then( tap( ( ) =>
			{
				concurrencies.push( ++concur );
				return Promise.resolve( )
				.then( delayChain( index * 4 ) );
			} ) )
			.then( ( ) => map_( val ) )
			.then( tap( ( ) => { concurrencies.push( --concur ); } ) )
		) )
		.then( values => ( { values, concurrencies } ) );
	}

	it.concurrent( "unspecified concurrency should be correct", async ( ) =>
	{
		const { concurrencies, values } = await mapConcurrency(
			< number >< any >void 0,
			[ 1, 2, 3, 4, 5 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( typeof values[ 0 ] ).toBe( "string" );
		expect( values ).toEqual( [ "2", "4", "6", "8", "10" ] );
		expect( concurrencies ).toEqual( [ 1, 2, 3, 4, 5, 4, 3, 2, 1, 0 ] );
	} );

	it.concurrent( "concurrency 1 should be correct", async ( ) =>
	{
		const { concurrencies, values } = await mapConcurrency(
			1,
			[ 1, 2, 3, 4, 5 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( typeof values[ 0 ] ).toBe( "string" );
		expect( values ).toEqual( [ "2", "4", "6", "8", "10" ] );
		expect( concurrencies ).toEqual( [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ] );
	} );

	it.concurrent( "concurrency 2 should be correct", async ( ) =>
	{
		const { concurrencies, values } = await mapConcurrency(
			2,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( typeof values[ 0 ] ).toBe( "string" );
		expect( values ).toEqual(
			[ "2", "4", "6", "8", "10", "12", "14", "16", "18" ] );
		const last = concurrencies.pop( );
		expect( last ).toBe( 0 );
		expect( concurrencies ).not.toContain( 0 );
		expect( concurrencies ).toContain( 2 );
	} );

	it.concurrent( "concurrency 3 should be correct", async ( ) =>
	{
		const { concurrencies, values } = await mapConcurrency(
			3,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( typeof values[ 0 ] ).toBe( "string" );
		expect( values ).toEqual(
			[ "2", "4", "6", "8", "10", "12", "14", "16", "18" ] );
		const last = concurrencies.pop( );
		expect( last ).toBe( 0 );
		expect( concurrencies ).not.toContain( 0 );
		expect( concurrencies ).toContain( 3 );
	} );

	it.concurrent( "should work without options", async ( ) =>
	{
		const arr = [ 1, 2, Promise.resolve( 3 ), delayChain( 50 )( 4 ), 5 ];
		const arr2 = await Promise.all( arr )
		.then( map(
			( t: number ) =>
				t === 2
				? delay( 50 ).then( ( ) => ( { t: 2 } ) )
				: ( { t } )
		) );
		const arr3 = arr2.map( ( { t } ) => t );

		expect( arr3 ).toEqual( [ 1, 2, 3, 4, 5 ] );
	} );

	it.concurrent( "should work as a free function", async ( ) =>
	{
		const arr = [ 1, 2, Promise.resolve( 3 ), delayChain( 50 )( 4 ), 5 ];
		const arr2 = await map(
			arr,
			{ concurrency: 10 },
			t =>
				t === 2
				? delay( 50 ).then( ( ) => ( { t: 2 } ) )
				: ( { t } )
		);
		const arr3 = arr2.map( ( { t } ) => t );

		expect( arr3 ).toEqual( [ 1, 2, 3, 4, 5 ] );
	} );

	it.concurrent( "should work as a free function without options",
		async ( ) =>
	{
		const arr = [ 1, 2, Promise.resolve( 3 ), delayChain( 50 )( 4 ), 5 ];
		const arr2 = await map(
			arr,
			t =>
				t === 2
				? delay( 50 ).then( ( ) => ( { t: 2 } ) )
				: ( { t } )
		);
		const arr3 = arr2.map( ( { t } ) => t );

		expect( arr3 ).toEqual( [ 1, 2, 3, 4, 5 ] );
	} );
} );


describe( "reduce", ( ) =>
{
	function reduceAdd( acc: number, cur: number )
	{
		return acc + cur;
	}

	it.concurrent( "should reduce initialValue if empty array", async ( ) =>
	{
		const input: Array< number > = [ ];
		const initialValue = fooValue;

		const reduced = await reduce( input, reduceAdd, initialValue );

		expect( reduced ).toBe( fooValue );
	} );

	it.concurrent( "should reduce single-value array without initialValue",
		async ( ) =>
	{
		const input = [ fooValue ];

		const reduced = await reduce( input, reduceAdd );

		expect( reduced ).toBe( fooValue );
	} );

	it.concurrent( "should reduce single-value array with initialValue",
		async ( ) =>
	{
		const input = [ fooValue ];
		const initialValue = fooValue;

		const reduced = await reduce( input, reduceAdd, initialValue );

		expect( reduced ).toBe( fooValue + fooValue );
	} );

	it.concurrent( "should reduce multi-value array without initialValue",
		async ( ) =>
	{
		const input = [ fooValue, fooValue ];

		const reduced = await reduce( input, reduceAdd );

		expect( reduced ).toBe( fooValue + fooValue );
	} );

	it.concurrent( "should reduce multi-value array with initialValue",
		async ( ) =>
	{
		const input = [ fooValue, fooValue ];
		const initialValue = fooValue;

		const reduced = await reduce( input, reduceAdd, initialValue );

		expect( reduced ).toBe( fooValue + fooValue + fooValue );
	} );

	it.concurrent( "should handle future array and future values", async ( ) =>
	{
		const input = Promise.resolve( [ Promise.resolve( fooValue ), fooValue ] );
		const initialValue = Promise.resolve( fooValue );

		const reduced = await reduce( input, reduceAdd, initialValue );

		expect( reduced ).toBe( fooValue + fooValue + fooValue );
	} );

	it.concurrent( "should work in a promise chain without initialValue",
		async ( ) =>
	{
		const input = Promise.resolve( [ Promise.resolve( fooValue ), fooValue ] );

		const reduced = await input.then( reduce( reduceAdd ) );

		expect( reduced ).toBe( fooValue + fooValue );
	} );

	it.concurrent( "should work in a promise chain with initialValue",
		async ( ) =>
	{
		const input = Promise.resolve( [ Promise.resolve( fooValue ), fooValue ] );
		const initialValue = Promise.resolve( fooValue );

		const reduced = await input.then( reduce( reduceAdd, initialValue ) );

		expect( reduced ).toBe( fooValue + fooValue + fooValue );
	} );

	it.concurrent( "should handle reduce with different aggregate type",
		async ( ) =>
	{
		const makeLessThan = async ( than: number ) =>
		{
			async function foo( ) { }
			return await reduce(
				[ { a: 1 }, { a: 2 }, { a: 3 } ],
				async ( prev, { a } ) =>
				{
					await foo( );
					try
					{
						await foo( );
					}
					catch ( err )
					{
						return false;
					}
					return prev && a < than;
				},
				true
			);
		};

		expect( await makeLessThan( 3 ) ).toBe( false );
		expect( await makeLessThan( 4 ) ).toBe( true );
	} );
} );


describe( "each", ( ) =>
{
	describe( "with array", ( ) =>
	{
		it.concurrent( "should iterate empty array", async ( ) =>
		{
			const input: Array< number > = [ ];
			const spy = jest.fn( );

			each( input, ( _x: number ) => { } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls.length ).toBe( 0 );
		} );

		it.concurrent( "should iterate single-value array (inferred type)",
			async ( ) =>
		{
			const input = [ fooValue ];
			const spy = jest.fn( );

			const foo = ( _n: number ) => { };

			each( input, x => { foo( x ); } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls ).toEqual( [ [ fooValue, 0, 1 ] ] );
		} );

		it.concurrent( "should iterate single-value array", async ( ) =>
		{
			const input = [ fooValue ];
			const spy = jest.fn( );

			each( input, ( _x: number ) => { } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls ).toEqual( [ [ fooValue, 0, 1 ] ] );
		} );

		it.concurrent( "should iterate multi-value array", async ( ) =>
		{
			const input = [ fooValue, barValue, fooValue ];
			const spy = jest.fn( );

			each( input, ( _x: number ) => { } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls ).toEqual( [
				[ fooValue, 0, 3 ],
				[ barValue, 1, 3 ],
				[ fooValue, 2, 3 ],
			] );
		} );

		it.concurrent( "should iterate empty array asynchronously",
			async ( ) =>
		{
			const order: Array< number > = [ ];
			const input: Array< number > = [ ];
			const spy = jest.fn(
				async ( _a: number, index: number ) =>
				{
					order.push( index );
					await delay( 5 );
					order.push( index );
				}
			);

			each( input, async ( _x: number ) => { } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( order ).toEqual( [ ] );
		} );

		it.concurrent( "should iterate single-value array asynchronously",
			async ( ) =>
		{
			const order: Array< number > = [ ];
			const input = [ fooValue ];
			const spy = jest.fn(
				async ( _a: number, index: number ) =>
				{
					order.push( index );
					await delay( 5 );
					order.push( index );
				}
			);

			each( input, async ( _x: number ) => { } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls ).toEqual( [ [ fooValue, 0, 1 ] ] );
			expect( order ).toEqual( [ 0, 0 ] );
		} );

		it.concurrent( "should iterate multi-value array asynchronously",
			async ( ) =>
		{
			const order: Array< number > = [ ];
			const input = [ fooValue, barValue, fooValue ];
			const spy = jest.fn(
				async ( _a: number, index: number ) =>
				{
					order.push( index );
					await delay( 5 );
					order.push( index );
				}
			);

			each( input, async ( _x: number ) => { } ); // Type safety test
			const arr = await each( input, spy );

			expect( arr ).toEqual( input );
			expect( spy.mock.calls ).toEqual( [
				[ fooValue, 0, 3 ],
				[ barValue, 1, 3 ],
				[ fooValue, 2, 3 ],
			] );
			expect( order ).toEqual( [ 0, 0, 1, 1, 2, 2 ] );
		} );
	} );

	describe( "in promise chain", ( ) =>
	{
		it.concurrent( "should iterate empty array", async ( ) =>
		{
			const input = Promise.resolve( [ ] );
			const spy = jest.fn( );

			input.then( each( ( _x: number ) => { } ) ); // Type safety test
			const arr = await input.then( each( spy ) );

			expect( arr ).toEqual( await input );
			expect( spy.mock.calls.length ).toBe( 0 );
		} );

		it.concurrent( "should iterate single-value array", async ( ) =>
		{
			const input = Promise.resolve( [ fooValue ] );
			const spy = jest.fn( );

			input.then( each( ( _x: number ) => { } ) ); // Type safety test
			const arr = await input.then( each( spy ) );

			expect( arr ).toEqual( await input );
			expect( spy.mock.calls ).toEqual( [ [ fooValue, 0, 1 ] ] );
		} );

		it.concurrent( "should iterate multi-value array", async ( ) =>
		{
			const input = Promise.resolve( [ fooValue, barValue, fooValue ] );
			const spy = jest.fn( );

			input.then( each( ( _x: number ) => { } ) ); // Type safety test
			const arr = await input.then( each( spy ) );

			expect( arr ).toEqual( await input );
			expect( spy.mock.calls ).toEqual( [
				[ fooValue, 0, 3 ],
				[ barValue, 1, 3 ],
				[ fooValue, 2, 3 ],
			] );
		} );

		it.concurrent( "should iterate empty array asynchronously",
			async ( ) =>
		{
			const order: Array< number > = [ ];
			const input = Promise.resolve( [ ] );
			const spy = jest.fn(
				async ( _a: string, index: number ) =>
				{
					order.push( index );
					await delay( 5 );
					order.push( index );
				}
			);

			input.then( each( async ( _x: number ) => { } ) ); // TS test
			const arr = await input.then( each( spy ) );

			expect( arr ).toEqual( await input );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( order ).toEqual( [ ] );
		} );

		it.concurrent( "should iterate single-value array asynchronously",
			async ( ) =>
		{
			const order: Array< number > = [ ];
			const input = Promise.resolve( [ fooValue ] );
			const spy = jest.fn(
				async ( _a: number, index: number ) =>
				{
					order.push( index );
					await delay( 5 );
					order.push( index );
				}
			);

			input.then( each( async ( _x: number ) => { } ) ); // TS test
			const arr = await input.then( each( spy ) );

			expect( arr ).toEqual( await input );
			expect( spy.mock.calls ).toEqual( [ [ fooValue, 0, 1 ] ] );
			expect( order ).toEqual( [ 0, 0 ] );
		} );

		it.concurrent( "should iterate multi-value array asynchronously",
			async ( ) =>
		{
			const order: Array< number > = [ ];
			const input = Promise.resolve( [ fooValue, barValue, fooValue ] );
			const spy = jest.fn(
				async ( _a: number, index: number ) =>
				{
					order.push( index );
					await delay( 5 );
					order.push( index );
				}
			);

			input.then( each( async ( _x: number ) => { } ) ); // TS test
			const arr = await input.then( each( spy ) );

			expect( arr ).toEqual( await input );
			expect( spy.mock.calls ).toEqual( [
				[ fooValue, 0, 3 ],
				[ barValue, 1, 3 ],
				[ fooValue, 2, 3 ],
			] );
			expect( order ).toEqual( [ 0, 0, 1, 1, 2, 2 ] );
		} );
	} );
} );


describe( "some", ( ) =>
{
	function somePredNull( _val: number )
	{
		return null; // Falsy
	}
	function somePred( val: number )
	{
		return { val };
	}
	function somePredIf( matched: number )
	{
		return ( val: number ) =>
		{
			if ( matched === val )
				return { val };
			return 0; // Falsy
		};
	}
	function asyncSomePredNull( _val: number )
	{
		return Promise.resolve( null ); // Falsy
	}
	function asyncSomePred( val: number )
	{
		return Promise.resolve( { val } );
	}
	function asyncSomePredIf( matched: number )
	{
		return ( val: number )
		: Promise< { val: number; } | false > =>
		{
			if ( matched === val )
				return Promise.resolve( { val } );
			return < Promise< false > >Promise.resolve( false ); // Falsy
		};
	}

	describe( "sync flat", ( ) =>
	{
		it.concurrent( "should be false on empty array", async ( ) =>
		{
			const input: Array< number > = [ ];

			const res = await some( input, somePred );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return false on unmatching single-value array",
			async ( ) =>
		{
			const input = [ fooValue ];

			const res = await some( input, somePredNull );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return value on matching single-value array",
			async ( ) =>
		{
			const input = [ fooValue ];

			const res = await some( input, somePred );

			expect( res ).toEqual( { val: fooValue } );
		} );

		it.concurrent( "should return false on unmatching multi-value array",
			async ( ) =>
		{
			const input = [ fooValue, fooValue + 1, fooValue + 2 ];

			const res = await some( input, somePredNull );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return first match in multi-value array",
			async ( ) =>
		{
			const input = [ fooValue, fooValue + 1, fooValue + 2 ];

			const res = await some( input, somePredIf( fooValue + 1 ) );

			expect( res ).toEqual( { val: fooValue + 1 } );
		} );
	} );

	describe( "sync in promise chain", ( ) =>
	{
		it.concurrent( "should be false on empty array", async ( ) =>
		{
			const res = await
				Promise.resolve( [ ] )
				.then( some( somePred ) );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return false on unmatching single-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue ] )
				.then( some( somePredNull ) );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return value on matching single-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue ] )
				.then( some( somePred ) );

			expect( res ).toEqual( { val: fooValue } );
		} );

		it.concurrent( "should return false on unmatching multi-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue, fooValue + 1, fooValue + 2 ] )
				.then( some( somePredNull ) );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return first match in multi-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue, fooValue + 1, fooValue + 2 ] )
				.then( some( somePredIf( fooValue + 1 ) ) );

			expect( res ).toEqual( { val: fooValue + 1 } );
		} );
	} );

	describe( "async flat", ( ) =>
	{
		it.concurrent( "should be false on empty array", async ( ) =>
		{
			const input: Array< number > = [ ];

			const res = await some( input, asyncSomePred );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return false on unmatching single-value array",
			async ( ) =>
		{
			const input = [ fooValue ];

			const res = await some( input, asyncSomePredNull );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return value on matching single-value array",
			async ( ) =>
		{
			const input = [ fooValue ];

			const res = await some( input, asyncSomePred );

			expect( res ).toEqual( { val: fooValue } );
		} );

		it.concurrent( "should return false on unmatching multi-value array",
			async ( ) =>
		{
			const input = [ fooValue, fooValue + 1, fooValue + 2 ];

			const res = await some( input, asyncSomePredNull );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return first match in multi-value array",
			async ( ) =>
		{
			const input = [ fooValue, fooValue + 1, fooValue + 2 ];

			const res = await some( input, asyncSomePredIf( fooValue + 1 ) );

			expect( res ).toEqual( { val: fooValue + 1 } );
		} );
	} );

	describe( "async in promise chain", ( ) =>
	{
		it.concurrent( "should be false on empty array", async ( ) =>
		{
			const res = await
				Promise.resolve( [ ] )
				.then( some( asyncSomePred ) );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return false on unmatching single-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue ] )
				.then( some( asyncSomePredNull ) );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return value on matching single-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue ] )
				.then( some( asyncSomePred ) );

			expect( res ).toEqual( { val: fooValue } );
		} );

		it.concurrent( "should return false on unmatching multi-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue, fooValue + 1, fooValue + 2 ] )
				.then( some( asyncSomePredNull ) );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return first match in multi-value array",
			async ( ) =>
		{
			const res = await
				Promise.resolve( [ fooValue, fooValue + 1, fooValue + 2 ] )
				.then( some( asyncSomePredIf( fooValue + 1 ) ) );

			expect( res ).toEqual( { val: fooValue + 1 } );
		} );
	} );

	describe( "promise of lists and items", ( ) =>
	{
		function promisifyList< T >( list: ReadonlyArray< T > )
		{
			return Promise.resolve(
				list.map( item => Promise.resolve( item ) )
			);
		}

		it.concurrent( "should be false on empty array", async ( ) =>
		{
			const res = await some( Promise.resolve( [ ] ), asyncSomePred );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return false on unmatching single-value array",
			async ( ) =>
		{
			const input = promisifyList( [ fooValue ] );

			const res = await some( input, asyncSomePredNull );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return value on matching single-value array",
			async ( ) =>
		{
			const input = promisifyList( [ fooValue ] );

			const res = await some( input, asyncSomePred );

			expect( res ).toEqual( { val: fooValue } );
		} );

		it.concurrent( "should return false on unmatching multi-value array",
			async ( ) =>
		{
			const input =
				promisifyList( [ fooValue, fooValue + 1, fooValue + 2 ] );

			const res = await some( input, asyncSomePredNull );

			expect( res ).toBe( false );
		} );

		it.concurrent( "should return first match in multi-value array",
			async ( ) =>
		{
			const input =
				promisifyList( [ fooValue, fooValue + 1, fooValue + 2 ] );

			const res = await some( input, asyncSomePredIf( fooValue + 1 ) );

			expect( res ).toEqual( { val: fooValue + 1 } );
		} );
	} );
} );


describe( "once", ( ) =>
{
	const delayedFunction = ( ) =>
		( ) =>
			delay( 5 ).then( ( ) => 42 );

	const delayedFunctionWithArg = ( ) =>
		( val: number ) =>
			delay( 5 ).then( ( ) => val * 2 );

	const delayedFunctionWithArgReturningVoid = ( ) =>
		( _val: number ) =>
			delay( 5 ).then( ( ) => { } );

	describe( "pre-defined function", ( ) =>
	{
		it( "should call synchronously once", ( ) =>
		{
			const spy = jest.fn( );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			_once( );
			expect( spy.mock.calls.length ).toBe( 1 );
			_once( );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "should call asynchronously once", async ( ) =>
		{
			const spy = jest.fn( delayedFunction( ) );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			await _once( );
			expect( spy.mock.calls.length ).toBe( 1 );
			await _once( );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it( "should call synchronously once with value", ( ) =>
		{
			const spy = jest.fn( ( ) => 42 );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( _once( ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
			expect( _once( ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "should call asynchronously once with value",
			async ( ) =>
		{
			const spy = jest.fn( delayedFunction( ) );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( await _once( ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
			expect( await _once( ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it( "should call synchronously once with arg", ( ) =>
		{
			const spy = jest.fn( ( _v: number ) => { } );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			_once( 4 );
			expect( spy.mock.calls.length ).toBe( 1 );
			_once( 5 );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "should call asynchronously once with arg", async ( ) =>
		{
			const spy = jest.fn( delayedFunctionWithArgReturningVoid( ) );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( await _once( 21 ) ).toBe( undefined );
			expect( spy.mock.calls.length ).toBe( 1 );
			expect( await _once( 22 ) ).toBe( undefined );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it( "should call synchronously once with arg and return value", ( ) =>
		{
			const spy = jest.fn( ( v: number ) => v * 2 );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( _once( 21 ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
			expect( _once( 22 ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "should call asynchronously once with arg and value",
			async ( ) =>
		{
			const spy = jest.fn( delayedFunctionWithArg( ) );

			const _once = once( spy );
			expect( spy.mock.calls.length ).toBe( 0 );
			expect( await _once( 21 ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
			expect( await _once( 22 ) ).toBe( 42 );
			expect( spy.mock.calls.length ).toBe( 1 );
		} );
	} );

	describe( "per-function uniqueness", ( ) =>
	{
		it( "should call synchronously once", ( ) =>
		{
			const _once = once( );

			const spy1 = jest.fn( );
			const spy2 = jest.fn( );

			expect( spy1.mock.calls.length ).toBe( 0 );
			_once( spy1 );
			expect( spy1.mock.calls.length ).toBe( 1 );
			_once( spy1 );
			expect( spy1.mock.calls.length ).toBe( 1 );

			expect( spy2.mock.calls.length ).toBe( 0 );
			_once( spy2 );
			expect( spy2.mock.calls.length ).toBe( 1 );
			_once( spy2 );
			expect( spy2.mock.calls.length ).toBe( 1 );

			expect( spy1.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "should call asynchronously once", async ( ) =>
		{
			const _once = once( );

			const spy1 = jest.fn( delayedFunction( ) );
			const spy2 = jest.fn( delayedFunction( ) );

			expect( spy1.mock.calls.length ).toBe( 0 );
			await _once( spy1 );
			expect( spy1.mock.calls.length ).toBe( 1 );
			await _once( spy1 );
			expect( spy1.mock.calls.length ).toBe( 1 );

			expect( spy2.mock.calls.length ).toBe( 0 );
			await _once( spy2 );
			expect( spy2.mock.calls.length ).toBe( 1 );
			await _once( spy2 );
			expect( spy2.mock.calls.length ).toBe( 1 );

			expect( spy1.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "should call asynchronously once (stressed)",
			async ( ) =>
		{
			const _once = once( );

			const spy1 = jest.fn( delayedFunction( ) );
			const spy2 = jest.fn( delayedFunction( ) );

			expect( spy1.mock.calls.length ).toBe( 0 );
			const awaitOnce1 = _once( spy1 );
			expect( spy1.mock.calls.length ).toBe( 1 );
			const awaitOnce2 = _once( spy1 );
			expect( spy1.mock.calls.length ).toBe( 1 );

			expect( spy2.mock.calls.length ).toBe( 0 );
			const awaitOnce3 = _once( spy2 );
			expect( spy2.mock.calls.length ).toBe( 1 );
			const awaitOnce4 = _once( spy2 );
			expect( spy2.mock.calls.length ).toBe( 1 );

			expect( spy1.mock.calls.length ).toBe( 1 );

			await awaitOnce1;
			await awaitOnce2;
			await awaitOnce3;
			await awaitOnce4;
		} );
	} );
} );


describe( "retry", ( ) =>
{
	const allTimes = [ 0, 1, 2, 3 ];
	const times = ( < Array< Array< number > > >[ ] ).concat(
		...allTimes.map( times1 =>
			allTimes.map( times2 => [ times1, times2 ] )
		)
	);

	describe( "sync", ( ) =>
	{
		const throwFirst = < R >( times: number, returnValue: R ) =>
		{
			return ( ): R =>
			{
				if ( --times < 0 )
					return returnValue;
				throw testError;
			};
		};

		times.forEach( ( [ returnAfter, retryTimes ] ) =>
		{
			const shouldThrow = returnAfter > retryTimes && returnAfter > 0;

			const msg = `should ${shouldThrow ? "" : "not "}throw ` +
				`after ${retryTimes} retries ` +
				`when returning after ${returnAfter} times`;

			it( msg, ( ) =>
			{
				if ( shouldThrow )
				{
					const thrower = throwFirst( returnAfter, 42 );

					expect( ( ) => retry( retryTimes, thrower ) )
						.toThrow( testError );
				}
				else
				{
					const thrower = throwFirst( returnAfter, 42 );

					expect( retry( retryTimes, thrower ) ).toBe( 42 );
				}
			} );
		} );

		it( "should rethrow on immediately false predicate", ( ) =>
		{
			const thrower = throwFirst( 5, 42 );

			expect( ( ) => retry( 10, thrower, ( ) => false ) )
				.toThrow( testError );
		} );

		it( "should rethrow on eventually false predicate", ( ) =>
		{
			const thrower = throwFirst( 5, 42 );

			let i = 2;

			expect( ( ) => retry( 10, thrower, ( ) => --i > 0 ) )
				.toThrow( testError );
		} );
	} );

	describe( "async", ( ) =>
	{
		const throwFirst = < R >( times: number, returnValue: R ) =>
		{
			return async ( ): Promise< R > =>
			{
				await delay( 1 );

				if ( --times < 0 )
					return returnValue;
				throw testError;
			};
		};

		times.forEach( ( [ returnAfter, retryTimes ] ) =>
		{
			const shouldThrow = returnAfter > retryTimes && returnAfter > 0;

			const msg = `should ${shouldThrow ? "" : "not "}throw ` +
				`after ${retryTimes} retries ` +
				`when returning after ${returnAfter} times`;

			it.concurrent( msg, async ( ) =>
			{
				if ( shouldThrow )
				{
					const thrower = throwFirst( returnAfter, 42 );

					const result =
						await reflect( retry( retryTimes, thrower ) );
					expect( result.isRejected ).toBe( true );
					expect( result.error ).toBe( testError );
					}
				else
				{
					const thrower = throwFirst( returnAfter, 42 );

					expect( await retry( retryTimes, thrower ) ).toBe( 42 );
				}
			} );
		} );

		it.concurrent( "should rethrow on immediately false predicate",
			async ( ) =>
		{
			const thrower = throwFirst( 5, 42 );

			const result =
				await reflect( retry( 10, thrower, ( ) => false ) );

			expect( result.isRejected ).toBe( true );
			expect( result.error ).toBe( testError );
		} );

		it.concurrent( "should rethrow on eventually false predicate",
			async ( ) =>
		{
			const thrower = throwFirst( 5, 42 );

			let i = 2;

			const result =
				await reflect( retry( 10, thrower, ( ) => --i > 0 ) );

			expect( result.isRejected ).toBe( true );
			expect( result.error ).toBe( testError );
		} );
	} );
} );


describe( "defer", ( ) =>
{
	it.concurrent( "should work with undefined and no resolve argument",
		async ( ) =>
	{
		const deferred = defer( void 0 );

		deferred.resolve( );

		const val = await deferred.promise;
		expect( val ).toBe( void 0 );
	} );

	it.concurrent( "should work with undefined and one resolve argument",
		async ( ) =>
	{
		const deferred = defer( void 0 );

		deferred.resolve( void 0 );

		const val = await deferred.promise;
		expect( val ).toBe( void 0 );
	} );

	it.concurrent( "should work with resolving", async ( ) =>
	{
		const deferred = defer< number >( );

		deferred.resolve( fooValue );

		const val = await deferred.promise;
		expect( val ).toBe( fooValue );
	} );

	it.concurrent( "should work with rejecting", async ( ) =>
	{
		const deferred = defer< number >( );

		deferred.reject( new Error( fooError ) );

		return deferred.promise
		.then( ( ) =>
		{
			throw new Error( "promise shouldn't be resolved" );
		} )
		.catch( err =>
		{
			if ( err.message !== fooError )
				throw err;
		} );
	} );
} );


describe( "reflect", ( ) =>
{
	it.concurrent( "should work with resolved promises", async ( ) =>
	{
		const p = Promise.resolve( fooValue );

		const reflected = await reflect( p );

		const { value, error, isResolved, isRejected } = reflected;

		expect( isResolved ).toBe( true );
		expect( isRejected ).toBe( false );
		expect( value ).toBe( fooValue );
		expect( error ).toBe( void 0 );
	} );

	it.concurrent( "should work with not yet resolved promises", async ( ) =>
	{
		const p = delay( 1, fooValue );

		const reflected = await reflect( p );

		const { value, error, isResolved, isRejected } = reflected;

		expect( isResolved ).toBe( true );
		expect( isRejected ).toBe( false );
		expect( value ).toBe( fooValue );
		expect( error ).toBe( void 0 );
	} );

	it.concurrent( "should work with rejected promises", async ( ) =>
	{
		const p = Promise.reject( fooError );

		const reflected = await reflect( p );

		const { value, error, isResolved, isRejected } = reflected;

		expect( isResolved ).toBe( false );
		expect( isRejected ).toBe( true );
		expect( value ).toBe( void 0 );
		expect( error ).toBe( fooError );
	} );

	it.concurrent( "should work with not yet rejected promises", async ( ) =>
	{
		const p = delay( 1 ).then( ( ) => { throw fooError; } );

		const reflected = await reflect( p );

		const { value, error, isResolved, isRejected } = reflected;

		expect( isResolved ).toBe( false );
		expect( isRejected ).toBe( true );
		expect( value ).toBe( void 0 );
		expect( error ).toBe( fooError );
	} );
} );


describe( "inspect", ( ) =>
{
	it.concurrent( "should work with pending", async ( ) =>
	{
		const deferred = defer< string >( );

		const inspectable = inspect( deferred.promise );

		await delay( 1 );

		expect( inspectable.isPending ).toBe( true );
		expect( inspectable.isResolved ).toBe( false );
		expect( inspectable.isRejected ).toBe( false );

		deferred.resolve( "" );

		return inspectable.promise;
	} );

	it.concurrent( "should work with resolving", async ( ) =>
	{
		const deferred = defer< string >( );

		const inspectable = inspect( deferred.promise );

		deferred.resolve( "" );

		await delay( 1 );

		expect( inspectable.isPending ).toBe( false );
		expect( inspectable.isResolved ).toBe( true );
		expect( inspectable.isRejected ).toBe( false );

		return inspectable.promise;
	} );

	it.concurrent( "should work with rejecting", async ( ) =>
	{
		const deferred = defer< string >( );

		const inspectable = inspect( deferred.promise );

		// Register catch handler before asynchronously rejecting upstream
		// to avoid erroneous nodejs warning about unhandled rejections.
		inspectable.promise.catch( _err => { } );

		deferred.reject( new Error( ) );

		await delay( 1 );

		expect( inspectable.isPending ).toBe( false );
		expect( inspectable.isResolved ).toBe( false );
		expect( inspectable.isRejected ).toBe( true );

		return inspectable.promise.catch( _err => { } );
	} );

	it.concurrent( "should be settled after {await}", async ( ) =>
	{
		const deferred = defer< string >( );

		deferred.resolve( "" );

		const inspectable = await inspect( deferred.promise );

		expect( inspectable.isPending ).toBe( false );
		expect( inspectable.isResolved ).toBe( true );
		expect( inspectable.isRejected ).toBe( false );

		return inspectable.promise;
	} );
} );


describe( "deferInspectable", ( ) =>
{
	it.concurrent( "should resolve and reject", async ( ) =>
	{
		const deferredRes = deferInspectable< string >( );
		const deferredRej = deferInspectable< string >( );

		expect( deferredRes.isPending ).toBe( true );
		expect( deferredRes.isResolved ).toBe( false );
		expect( deferredRes.isRejected ).toBe( false );
		expect( deferredRej.isPending ).toBe( true );
		expect( deferredRej.isResolved ).toBe( false );
		expect( deferredRej.isRejected ).toBe( false );

		deferredRes.resolve( "foo" );
		deferredRej.reject( new Error( "err" ) );

		expect( deferredRes.isPending ).toBe( false );
		expect( deferredRes.isResolved ).toBe( true );
		expect( deferredRes.isRejected ).toBe( false );
		expect( deferredRej.isPending ).toBe( false );
		expect( deferredRej.isResolved ).toBe( false );
		expect( deferredRej.isRejected ).toBe( true );

		expect( await deferredRes.promise ).toBe( "foo" );
		expect( await deferredRej.promise.catch( err => err.message ) )
			.toBe( "err" );
	} );

	it.concurrent( "should not double-resolve or double-reject", async ( ) =>
	{
		const deferredRes = deferInspectable< string >( );
		const deferredRej = deferInspectable< string >( );

		expect( deferredRes.isPending ).toBe( true );
		expect( deferredRes.isResolved ).toBe( false );
		expect( deferredRes.isRejected ).toBe( false );
		expect( deferredRej.isPending ).toBe( true );
		expect( deferredRej.isResolved ).toBe( false );
		expect( deferredRej.isRejected ).toBe( false );

		deferredRes.resolve( "foo" );
		deferredRes.resolve( "bar" );
		deferredRej.reject( new Error( "err" ) );
		deferredRej.reject( new Error( "bork" ) );

		expect( deferredRes.isPending ).toBe( false );
		expect( deferredRes.isResolved ).toBe( true );
		expect( deferredRes.isRejected ).toBe( false );
		expect( deferredRej.isPending ).toBe( false );
		expect( deferredRej.isResolved ).toBe( false );
		expect( deferredRej.isRejected ).toBe( true );

		expect( await deferredRes.promise ).toBe( "foo" );
		expect( await deferredRej.promise.catch( err => err.message ) )
			.toBe( "err" );
	} );

	// it( "should work with resolving", async ( ) =>
	// {
	// 	const deferred = deferInspectable< string >( );

	// 	const inspectable = inspect( deferred.promise );

	// 	deferred.resolve( "" );

	// 	await delay( 1 );

	// 	expect( inspectable.isPending ).toBe( false );
	// 	expect( inspectable.isResolved ).toBe( true );
	// 	expect( inspectable.isRejected ).toBe( false );

	// 	return inspectable.promise;
	// } );

	// it( "should work with rejecting", async ( ) =>
	// {
	// 	const deferred = deferInspectable< string >( );

	// 	const inspectable = inspect( deferred.promise );

	// 	// Register catch handler before asynchronously rejecting upstream
	// 	// to avoid erroneous nodejs warning about unhandled rejections.
	// 	inspectable.promise.catch( err => { } );

	// 	deferred.reject( new Error( ) );

	// 	await delay( 1 );

	// 	expect( inspectable.isPending ).toBe( false );
	// 	expect( inspectable.isResolved ).toBe( false );
	// 	expect( inspectable.isRejected ).toBe( true );

	// 	return inspectable.promise.catch( err => { } );
	// } );

	// it( "should be settled after {await}", async ( ) =>
	// {
	// 	const deferred = deferInspectable< string >( );

	// 	deferred.resolve( "" );

	// 	const inspectable = await inspect( deferred.promise );

	// 	expect( inspectable.isPending ).toBe( false );
	// 	expect( inspectable.isResolved ).toBe( true );
	// 	expect( inspectable.isRejected ).toBe( false );

	// 	return inspectable.promise;
	// } );
} );


describe( "try", ( ) =>
{
	it( "should work without return value", async ( ) =>
	{
		const ret = await (
			Try( ( ) => { } )
			.then( val => val )
		);

		expect( ret ).toBe( void 0 );
	} );

	it( "should work with return value", async ( ) =>
	{
		const ret = await (
			Try( ( ) => "foo" )
			.then( val => val )
		);

		expect( typeof ret ).toBe( "string" );
		expect( ret ).toBe( "foo" );
	} );

	it( "should work with a throwing function", async ( ) =>
	{
		function fn( ): string
		{
			throw new Error( fooError );
		}
		try
		{
			await (
				Try( fn )
				.then( val => val )
			);
			expect( false ).toBe( true ); // We shouldn't be here
		}
		catch ( err )
		{
			if ( err.message !== fooError )
				throw err;
		}
	} );
} );


describe( "specific", ( ) =>
{
	function CustomErrorA( args?: any )
	{
		Error( args );
		if ( ( < any >Error ).captureStackTrace )
			// @ts-ignore
			( < any >Error ).captureStackTrace( < any >this, CustomErrorA );
	}
	CustomErrorA.prototype = Object.create( Error.prototype );
	CustomErrorA.prototype.constructor = CustomErrorA;

	function CustomErrorB( args?: any )
	{
		Error( args );
		if ( ( < any >Error ).captureStackTrace )
			// @ts-ignore
			( < any >Error ).captureStackTrace( < any >this, CustomErrorB );
	}
	CustomErrorB.prototype = Object.create( Error.prototype );
	CustomErrorB.prototype.constructor = CustomErrorB;

	function isMyError( err: Error )
	{
		return ( < any >err ).myError === true;
	}
	function isNotMyError( err: Error )
	{
		return !( < any >err ).myError;
	}

	it( "should treat nully as false", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );

		await Promise.reject( err )
		.catch( specific( null, spy ) )
		.catch( ( ) => { } );

		expect( spy.mock.calls.length ).toBe( 0 );
	} );

	it( "should treat invalid specific clauses as false", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );

		await Promise.reject( err )
		.catch( specific( < any >"custom-a", spy ) )
		.catch( ( ) => { } );

		expect( spy.mock.calls.length ).toBe( 0 );
	} );

	it( "should filter single class", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );

		await Promise.reject( err )
		.catch( specific( CustomErrorA, spy ) );

		expect( spy.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should filter two classes", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );

		await Promise.reject( err )
		.catch( specific( [ CustomErrorA, CustomErrorB ], spy ) );

		expect( spy.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should skip two classes", async ( ) =>
	{
		const spy1 = jest.fn( );
		const spy2 = jest.fn( );

		const err = new Error( "custom-a" );

		await Promise.reject( err )
		.catch( specific( [ CustomErrorB, CustomErrorA ], spy1 ) )
		.catch( spy2 );

		expect( spy1.mock.calls.length ).toBe( 0 );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should filter one function", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( isMyError, spy ) );

		expect( spy.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should filter two functions", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( [ isNotMyError, isMyError ], spy ) );

		expect( spy.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should skip two functions", async ( ) =>
	{
		const spy1 = jest.fn( );
		const spy2 = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = "not true";

		await Promise.reject( err )
		.catch( specific( [ isNotMyError, isMyError ], spy1 ) )
		.catch( spy2 );

		expect( spy1.mock.calls.length ).toBe( 0 );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should filter one object", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( { myError: true }, spy ) );

		expect( spy.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should filter two objects", async ( ) =>
	{
		const spy = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( [ { foo: "bar" }, { myError: true } ], spy ) );

		expect( spy.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should skip two objects", async ( ) =>
	{
		const spy1 = jest.fn( );
		const spy2 = jest.fn( );

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = "not true";

		await Promise.reject( err )
		.catch( specific( [ { a: 1 }, { b: 2 } ], spy1 ) )
		.catch( spy2 );

		expect( spy1.mock.calls.length ).toBe( 0 );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should handle promise-returning callback", async ( ) =>
	{
		interface I
		{
			i: number;
		}
		async function callback( ): Promise< I >
		{
			return { i: 2 };
		}

		// @ts-ignore
		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		const res = await Promise.reject< I >( err )
		.catch( specific( { myError: true } , callback ) );

		expect( res ).toEqual( { i: 2 } );
	} );
} );


describe( "rethrow", ( ) =>
{
	it( "should rethrow error on synchronous callback", async ( ) =>
	{
		const spy1 = jest.fn( );
		const spy2 = jest.fn( );

		const err = new Error( "error" );

		await Promise.reject( err )
		.catch( rethrow( spy1 ) )
		.catch( spy2 );

		expect( spy1.mock.calls[ 0 ][ 0 ] ).toBe( err );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should rethrow error on asynchronous callback", async ( ) =>
	{
		const spy1 = jest.fn( );
		const spy2 = jest.fn( );

		const err = new Error( "error" );

		async function proxy( err: any )
		{
			await delay( 10 );
			spy1( err );
		}

		await Promise.reject( err )
		.catch( rethrow( proxy ) )
		.finally( ( ) =>
		{
			expect( spy1.mock.calls.length ).toBe( 1 );
			expect( spy2.mock.calls.length ).toBe( 0 );
		} )
		.catch( spy2 );

		expect( spy1.mock.calls[ 0 ][ 0 ] ).toBe( err );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err );
	} );

	it( "should throw synchronous callback error", async ( ) =>
	{
		const err1 = new Error( "error" );
		const err2 = new Error( "error" );

		function wrapper( _err: any )
		{
			throw err2;
		}

		const spy1 = jest.fn( wrapper );
		const spy2 = jest.fn( );

		await Promise.reject( err1 )
		.catch( rethrow( spy1 ) )
		.catch( spy2 );

		expect( spy1.mock.calls[ 0 ][ 0 ] ).toBe( err1 );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err2 );
	} );

	it( "should throw asynchronous callback error", async ( ) =>
	{
		const err1 = new Error( "error" );
		const err2 = new Error( "error" );

		async function wrapper( _err: any )
		{
			await delay( 10 );
			throw err2;
		}

		const spy1 = jest.fn( wrapper );
		const spy2 = jest.fn( );

		await Promise.reject( err1 )
		.catch( rethrow( spy1 ) )
		.catch( spy2 );

		expect( spy1.mock.calls[ 0 ][ 0 ] ).toBe( err1 );
		expect( spy2.mock.calls[ 0 ][ 0 ] ).toBe( err2 );
	} );
} );


describe( "wrapFunction", ( ) =>
{
	function makeSpy0< W >( fun: ( ) => W )
	: jest.Mock & ( ( ) => W )
	{
		return < jest.Mock< W, any > & ( ( ) => W ) >jest.fn( fun );
	}
	function makeSpy< T, W >( fun: ( t: T ) => W )
	: jest.Mock & ( < T >( t: T ) => W )
	{
		return < jest.Mock< W, any > & ( ( t: T ) => W ) >
			jest.fn( fun );
	}

	describe( "(before, fn, after) combinations", ( ) =>
	{
		it( "sync sync sync noarg noreturn", ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => after );

			expect(
				wrapFunction( before )( ( ) => { } )
			).toBe( void 0 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it( "sync sync sync noarg", ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => after );

			expect( wrapFunction( before )( ( ) => 42 ) ).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it( "sync sync sync arg noreturn", ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => after );

			expect(
				wrapFunction( before )( "foo", ( ) => { } )
			).toBe( void 0 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it( "sync sync sync arg", ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => after );

			expect( wrapFunction( before )( "foo", ( ) => 42 ) ).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );


		it.concurrent( "async sync sync noarg noreturn", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( ( ) => { } )
			).toBe( void 0 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async sync sync noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => Promise.resolve( after ) );

			expect( await wrapFunction( before )( ( ) => 42 ) ).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async sync sync arg noreturn", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( "foo", ( ) => { } )
			).toBe( void 0 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async sync sync arg", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

			expect( await wrapFunction( before )( "foo", ( ) => 42 ) )
				.toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async sync noarg noreturn", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => after );

			expect(
				await wrapFunction( before )( ( ) => Promise.resolve( ) )
			).toBe( void 0 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async sync noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => after );

			expect(
				await wrapFunction( before )( ( ) => Promise.resolve( 42 ) )
			).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async sync arg noreturn", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => after );

			expect(
				await wrapFunction( before )( "foo", ( ) => Promise.resolve( ) )
			).toBe( void 0 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async sync arg", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => after );

			expect(
				await wrapFunction( before )( "foo", ( ) => Promise.resolve( 42 ) )
			).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );


		it.concurrent( "async async sync noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy0( ( ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( ( ) => Promise.resolve( 42 ) )
			).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async async sync arg", async ( ) =>
		{
			const after = makeSpy( ( ) => { } );
			const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )(
					"foo", ( ) => Promise.resolve( 42 )
				)
			).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync sync async noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy0( ( ) => after );

			expect( await wrapFunction( before )( ( ) => 42 ) ).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync sync async arg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy( ( _s: string ) => after );

			expect(
				await wrapFunction( before )( "foo", ( ) => 42 )
			).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );


		it.concurrent( "async sync async noarg noreturn", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy0( ( ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( ( ) => { } )
			).toBe( void 0 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async sync async noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy0( ( ) => Promise.resolve( after ) );

			expect( await wrapFunction( before )( ( ) => 42 ) ).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async sync async arg noreturn", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( "foo", ( ) => { } )
			).toBe( void 0 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async sync async arg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( "foo", ( ) => 42 )
			).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async async noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy0( ( ) => after );

			expect(
				await wrapFunction( before )( ( ) => Promise.resolve( 42 ) )
			).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async async noarg timing", async ( ) =>
		{
			const after = makeSpy( ( ) => delay( 10 ) );
			const before = makeSpy0( ( ) => after );

			const startAt = Date.now( );
			expect(
				await wrapFunction( before )(
					( ) => delay( 10 ).then( ( ) => 42 )
				)
			).toBe( 42 );
			const diff = Date.now( ) - startAt;
			expect( diff ).toBeGreaterThanOrEqual( 20 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "sync async async arg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy( ( _s: string ) => after );

			expect(
				await wrapFunction( before )(
					"foo", ( ) => Promise.resolve( 42 )
				)
			).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );


		it.concurrent( "async async async noarg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy0( ( ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )( ( ) => Promise.resolve( 42 ) )
			).toBe( 42 );

			expect( before.mock.calls.length ).toBe( 1 );
			expect( after.mock.calls.length ).toBe( 1 );
		} );

		it.concurrent( "async async async arg", async ( ) =>
		{
			const after = makeSpy( ( ) => Promise.resolve( ) );
			const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

			expect(
				await wrapFunction( before )(
					"foo", ( ) => Promise.resolve( 42 )
					)
			).toBe( 42 );

			expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
			expect( after.mock.calls.length ).toBe( 1 );
		} );
	} );

	it.concurrent( "Invalid (missing) argument", async ( ) =>
	{
		const after = makeSpy( ( ) => Promise.resolve( ) );
		const before = makeSpy( ( _s: string ) => Promise.resolve( after ) );

		await ( async ( ) =>
		{
			try
			{
				await ( < any >wrapFunction( before ) )
					( ( ) => Promise.resolve( 42 ) );
				expect( false ).toBe( true );
			}
			catch ( err )
			{
				expect( err.message ).toBe(
					"Invalid invocation, function requires 2 arguments"
				);
			}
		} )( );

		expect( before.mock.calls.length ).toBe( 0 );
		expect( after.mock.calls.length ).toBe( 0 );
	} );

	it.concurrent( 'Empty return from "before"', async ( ) =>
	{
		const before = makeSpy( ( _s: string ) => < ( ) => { } >< any >null );

		expect(
			await wrapFunction( before )( "foo", ( ) => Promise.resolve( 42 ) )
		).toBe( 42 );

		expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
	} );

	it.concurrent( 'Illegal return value from "before"', async ( ) =>
	{
		const before = makeSpy( ( _s: string ) => < ( ) => { } >< any >"bad" );

		await ( async ( ) =>
		{
			try
			{
				await ( wrapFunction( before ) )
					( "foo", ( ) => Promise.resolve( 42 ) );
				expect( false ).toBe( true );
			}
			catch ( err )
			{
				expect( err.message ).toBe(
					"Invalid return value in 'before' handler"
				);
			}
		} )( );

		expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
	} );

	it.concurrent( 'Async throw in "before"', async ( ) =>
	{
		const before = makeSpy(
			( _s: string ) => Promise.reject( new Error( "foobar" ) )
		);

		await ( async ( ) =>
		{
			try
			{
				await ( wrapFunction( before ) )
					( "foo", ( ) => Promise.resolve( 42 ) );
				expect( false ).toBe( true );
			}
			catch ( err )
			{
				expect( err.message ).toBe( "foobar" );
			}
		} )( );

		expect( before.mock.calls ).toEqual( [ [ "foo" ] ] );
	} );

	describe( "Cleanup on exceptions", ( ) =>
	{
		interface State { value: number; inc( ): void; dec( ): void; }
		function makeState( ): State
		{
			const state = {
				value: 0,
				inc( ) { ++state.value; },
				dec( ) { --state.value; },
			};

			return state;
		}

		const throwSync: ( ) => void =
			( ) => { throw new Error( "Foo" ); };
		const throwAsync: ( ) => Promise< void > =
			( ) => Promise.reject( new Error( "Foo" ) );

		async function swallowException( cb: ( ) => any )
		{
			try
			{
				await cb( );
				expect( true ).toBe( false );
			}
			catch ( err ) { }
		}

		function makeWrapper(
			state: State,
			syncBefore: boolean,
			syncAfter: boolean
		)
		{
			const after =
				syncAfter
				? ( ) => state.dec( )
				: async ( ) => state.dec( );

			return syncBefore
				? wrapFunction( ( ) =>
					{
						state.inc( );
						return after;
					} )
				: wrapFunction( async ( ) =>
					{
						state.inc( );
						return after;
					} );
		}

		it( "sync sync sync", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, true, true );

			await swallowException( ( ) => wrapper( throwSync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "async sync sync", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, false, true );

			await swallowException( ( ) => wrapper( throwSync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "sync async sync", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, true, true );

			await swallowException( ( ) => wrapper( throwAsync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "async async sync", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, false, true );

			await swallowException( ( ) => wrapper( throwAsync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "sync sync async", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, true, false );

			await swallowException( ( ) => wrapper( throwSync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "async sync async", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, false, false );

			await swallowException( ( ) => wrapper( throwSync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "sync async async", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, true, false );

			await swallowException( ( ) => wrapper( throwAsync ) );

			expect( state.value ).toBe( 0 );
		} );

		it( "async async async", async ( ) =>
		{
			const state = makeState( );
			const wrapper = makeWrapper( state, false, false );

			await swallowException( ( ) => wrapper( throwAsync ) );

			expect( state.value ).toBe( 0 );
		} );
	} );
} );
