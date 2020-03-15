#!/usr/bin/env node

const {
	readFileSync,
	writeFileSync,
	readdirSync,
	renameSync,
} = require( 'fs' );
const path = require( 'path' );

const dir = path.join( __dirname, '..', 'test-out-mjs' );

// Rename .js to .mjs
readdirSync( dir )
	.filter( filename => /\.js$/.test( filename ) )
	.map( filename => path.join( dir, filename ) )
	.forEach( filename =>
	{
		renameSync( filename, filename.replace( /\.js$/, '.mjs' ) );
	} );

const files =
	readdirSync( dir )
	.filter( filename => /\.mjs$/.test( filename ) )
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
			return m[ 1 ] + 'require("../dist-mjs");';
		} )
		.join( "\n" );

	writeFileSync( file, newData );
} );
