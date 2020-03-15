const hasModules =
  parseInt( process.versions.node.split( "." )[ 0 ], 10 ) > 12;

module.exports =
  hasModules
  ? require( './jest.config.modules' )
  : require( './jest.config.common' );
