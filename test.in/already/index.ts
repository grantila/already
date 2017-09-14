'use strict';

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import {
	delay,
	delayChain,
	Finally,
	tap,
	props,
	filter,
	map,
	defer,
	Try,
	specific,
} from '../../';

const fooError = "foo error";
const fooValue = 4711;

describe( 'finally', ( ) =>
{
	it( 'should be called on a resolved promise', ( ) =>
	{
		let called = false;

		return Promise.resolve( fooValue )
		.then( ...Finally( ( ) => { called = true; } ) )
		.then( num =>
		{
			if ( !called )
				throw new Error( "Finally callback not called!" );
			if ( num !== fooValue )
				throw new Error( "Finally callback altered dataflow!" );
		} );
	} );

	it( 'should be called on a rejected promise', ( ) =>
	{
		let called = false;

		return Promise.reject( new Error( fooError ) )
		.then( ...Finally( ( ) => { called = true; } ) )
		.then( ( ) =>
		{
			throw new Error( "Finally silently swallowed user error!" );
		} )
		.catch( err =>
		{
			if ( !called )
				throw new Error( "Finally callback not called!" );
			if ( err.message !== fooError )
				throw new Error( "Finally callback altered error!" );
		} );
	} );
} );

describe( 'tap', ( ) =>
{
	it( 'should be called on a resolved promise', ( ) =>
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

	it( 'should not be called on a rejected promise', ( ) =>
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
		.then( num =>
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

describe( 'props', ( ) =>
{
	it( 'should work', async ( ) =>
	{
		const val = await props( { a: 1, b: delay( 10 ).then( ( ) => 2 ) } );

		expect( val ).to.deep.equal( { a: 1, b: 2 } );
	} );
} );

describe( 'filter', ( ) =>
{
	function filterConcurrency< T >(
		concurrency: number,
		values: T[],
		filter_: ( ( t: T ) => ( boolean | PromiseLike< boolean > ) )
	)
	: Promise< { concurrencies: Array< number >; values: Array< T >; } >
	{
		let concur = 0;
		const concurrencies = [ ];

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

	it( 'concurrency 1 should be correct', async ( ) =>
	{
		let concur = 0;
		const { concurrencies, values } = await filterConcurrency(
			1,
			[ 1, 2, 3, 4, 5 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).to.deep.equal( [ 2, 4 ] );
		expect( concurrencies ).to.deep.equal( [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ] );
	} );

	it( 'concurrency 2 should be correct', async ( ) =>
	{
		let concur = 0;
		const { concurrencies, values } = await filterConcurrency(
			2,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).to.deep.equal( [ 2, 4, 6, 8 ] );
		const last = concurrencies.pop( );
		expect( last ).to.equal( 0 );
		expect( concurrencies ).to.not.include( 0 );
		expect( concurrencies ).to.include( 2 );
	} );

	it( 'concurrency 3 should be correct', async ( ) =>
	{
		let concur = 0;
		const { concurrencies, values } = await filterConcurrency(
			3,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => val % 2 === 0
		);

		expect( values ).to.deep.equal( [ 2, 4, 6, 8 ] );
		const last = concurrencies.pop( );
		expect( last ).to.equal( 0 );
		expect( concurrencies ).to.not.include( 0 );
		expect( concurrencies ).to.include( 3 );
	} );

	it( 'should work as a free function', async ( ) =>
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

		expect( arr2 ).to.deep.equal( [ 2, 4 ] );
	} );
} );

describe( 'map', ( ) =>
{
	function mapConcurrency< T, U >(
		concurrency: number,
		values: T[],
		map_: ( t: T ) => U
	)
	: Promise< { concurrencies: Array< number >; values: Array< U >; } >
	{
		let concur = 0;
		const concurrencies = [ ];

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

	it( 'concurrency 1 should be correct', async ( ) =>
	{
		let concur = 0;
		const { concurrencies, values } = await mapConcurrency(
			1,
			[ 1, 2, 3, 4, 5 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( values[ 0 ] ).to.be.a( 'string' );
		expect( values ).to.deep.equal( [ "2", "4", "6", "8", "10" ] );
		expect( concurrencies ).to.deep.equal( [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ] );
	} );

	it( 'concurrency 2 should be correct', async ( ) =>
	{
		let concur = 0;
		const { concurrencies, values } = await mapConcurrency(
			2,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( values[ 0 ] ).to.be.a( 'string' );
		expect( values ).to.deep.equal(
			[ "2", "4", "6", "8", "10", "12", "14", "16", "18" ] );
		const last = concurrencies.pop( );
		expect( last ).to.equal( 0 );
		expect( concurrencies ).to.not.include( 0 );
		expect( concurrencies ).to.include( 2 );
	} );

	it( 'concurrency 3 should be correct', async ( ) =>
	{
		let concur = 0;
		const { concurrencies, values } = await mapConcurrency(
			3,
			[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
			( val: number ) => "" + ( val * 2 )
		);

		expect( values[ 0 ] ).to.be.a( 'string' );
		expect( values ).to.deep.equal(
			[ "2", "4", "6", "8", "10", "12", "14", "16", "18" ] );
		const last = concurrencies.pop( );
		expect( last ).to.equal( 0 );
		expect( concurrencies ).to.not.include( 0 );
		expect( concurrencies ).to.include( 3 );
	} );

	it( 'should work as a free function', async ( ) =>
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

		expect( arr3 ).to.deep.equal( [ 1, 2, 3, 4, 5 ] );
	} );
} );

describe( 'defer', ( ) =>
{
	it( 'should work with resolving', async ( ) =>
	{
		const deferred = defer< number >( );

		deferred.resolve( fooValue );

		const val = await deferred.promise;
		expect( val ).to.equal( fooValue );
	} );

	it( 'should work with rejecting', async ( ) =>
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

describe( 'try', ( ) =>
{
	it( 'should work without return value', async ( ) =>
	{
		const ret = await (
			Try( ( ) => { } )
			.then( val => val )
		);

		expect( ret ).to.be.a( "undefined" );
	} );

	it( 'should work with return value', async ( ) =>
	{
		const ret = await (
			Try( ( ) => "foo" )
			.then( val => val )
		);

		expect( ret ).to.be.a( "string" );
		expect( ret ).to.equal( "foo" );
	} );

	it( 'should work with a throwing function', async ( ) =>
	{
		function fn( ): string
		{
			throw new Error( fooError );
		}
		try
		{
			const ret = await (
				Try( fn )
				.then( val => val )
			);
			expect( false ).to.equal( true ); // We shouldn't be here
		}
		catch ( err )
		{
			if ( err.message !== fooError )
				throw err;
		}
	} );
} );

describe( 'specific', ( ) =>
{
	function CustomErrorA( args? )
	{
		Error( args );
		if ( ( < any >Error ).captureStackTrace )
			( < any >Error ).captureStackTrace( this, CustomErrorA );
	}
	CustomErrorA.prototype = Object.create( Error.prototype );
	CustomErrorA.prototype.constructor = CustomErrorA;

	function CustomErrorB( args? )
	{
		Error( args );
		if ( ( < any >Error ).captureStackTrace )
			( < any >Error ).captureStackTrace( this, CustomErrorB );
	}
	CustomErrorB.prototype = Object.create( Error.prototype );
	CustomErrorB.prototype.constructor = CustomErrorB;

	function isMyError( err: Error )
	{
		return ( < any >err ).myError == true;
	}
	function isNotMyError( err: Error )
	{
		return !( < any >err ).myError;
	}

	it( 'should filter single class', async ( ) =>
	{
		const spy = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );

		await Promise.reject( err )
		.catch( specific( CustomErrorA, spy ) );

		sinon.assert.calledWith( spy, err );
	} );

	it( 'should filter two classes', async ( ) =>
	{
		const spy = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );

		await Promise.reject( err )
		.catch( specific( [ CustomErrorA, CustomErrorB ], spy ) );

		sinon.assert.calledWith( spy, err );
	} );

	it( 'should skip two classes', async ( ) =>
	{
		const spy1 = sinon.spy( );
		const spy2 = sinon.spy( );

		const err = new Error( "custom-a" );

		await Promise.reject( err )
		.catch( specific( [ CustomErrorB, CustomErrorA ], spy1 ) )
		.catch( spy2 );

		sinon.assert.notCalled( spy1 );
		sinon.assert.calledWith( spy2, err );
	} );

	it( 'should filter one function', async ( ) =>
	{
		const spy = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( isMyError, spy ) );

		sinon.assert.calledWith( spy, err );
	} );

	it( 'should filter two functions', async ( ) =>
	{
		const spy = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( [ isNotMyError, isMyError ], spy ) );

		sinon.assert.calledWith( spy, err );
	} );

	it( 'should skip two functions', async ( ) =>
	{
		const spy1 = sinon.spy( );
		const spy2 = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );
		err.myError = "not true";

		await Promise.reject( err )
		.catch( specific( [ isNotMyError, isMyError ], spy1 ) )
		.catch( spy2 );

		sinon.assert.notCalled( spy1 );
		sinon.assert.calledWith( spy2, err );
	} );

	it( 'should filter one object', async ( ) =>
	{
		const spy = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( { myError: true }, spy ) );

		sinon.assert.calledWith( spy, err );
	} );

	it( 'should filter two objects', async ( ) =>
	{
		const spy = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );
		err.myError = true;

		await Promise.reject( err )
		.catch( specific( [ { foo: 'bar' }, { myError: true } ], spy ) );

		sinon.assert.calledWith( spy, err );
	} );

	it( 'should skip two objects', async ( ) =>
	{
		const spy1 = sinon.spy( );
		const spy2 = sinon.spy( );

		const err = new CustomErrorA( "custom-a" );
		err.myError = "not true";

		await Promise.reject( err )
		.catch( specific( [ { a: 1 }, { b: 2 } ], spy1 ) )
		.catch( spy2 );

		sinon.assert.notCalled( spy1 );
		sinon.assert.calledWith( spy2, err );
	} );
} );
