#!/usr/bin/env node

const { readFileSync, writeFileSync, readdirSync } = require( 'fs' )
const path = require( 'path' )

const dir = path.join( __dirname, '..', 'test-out-es5' );

const files =
	readdirSync( dir )
	.filter( filename => /\.js$/.test( filename ) )
	.map( filename => path.join( dir, filename ) );

const re = /^(.*)require\("\.\.\/"\);$/;

files.forEach( file =>
{
	const data = readFileSync( file, { encoding: 'utf8' } );
	const newData = data
		.split( "\n" )
		.map( line =>
		{
			const m = line.match( re );
			if ( !m )
				return line;
			return m[ 1 ] + 'require("../es5");';
		} )
		.join( "\n" );

	writeFileSync( file, newData );
} );
