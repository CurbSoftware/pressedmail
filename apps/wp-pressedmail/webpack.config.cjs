/**
 * Webpack config for PressedMail Gutenberg blocks.
 *
 * Uses @wordpress/scripts default config as a base, with custom entry points
 * for each block. Output goes to plugin-files/assets/blocks/.
 *
 * Must use .cjs extension because package.json has "type": "module".
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );
const CopyPlugin = require( 'copy-webpack-plugin' );

const blocks = [
	// Email template blocks (static save.js).
	'email-variable',
	'email-button',
	'email-header',
	'email-footer',
	'email-divider',
	'email-columns',
	'email-column',
	'email-preheader',
	'email-editor-sidebar',
	// Email template blocks (dynamic render.php).
	'email-recent-posts',
	'email-site-info',
	// Email template blocks (static save.js, contact merge).
	'email-contact-field',
];

// Blocks that use render.php (dynamic server-side rendering).
const frontendBlocks = [
	'email-recent-posts',
	'email-site-info',
];

const entry = {};
blocks.forEach( ( block ) => {
	entry[ block ] = path.resolve( __dirname, `src/blocks/${ block }/index.js` );
} );

// Copy block.json files from source to output for all blocks (except sidebar which has none).
const copyPatterns = blocks
	.filter( ( block ) => block !== 'email-editor-sidebar' )
	.map( ( block ) => ( {
		from: path.resolve( __dirname, `src/blocks/${ block }/block.json` ),
		to: path.resolve(
			__dirname,
			`plugin-files/assets/blocks/${ block }/block.json`
		),
	} ) );

// Copy render.php for frontend dynamic blocks.
frontendBlocks.forEach( ( block ) => {
	copyPatterns.push( {
		from: path.resolve( __dirname, `src/blocks/${ block }/render.php` ),
		to: path.resolve(
			__dirname,
			`plugin-files/assets/blocks/${ block }/render.php`
		),
	} );
} );

module.exports = {
	...defaultConfig,
	entry,
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'plugin-files/assets/blocks' ),
		filename: '[name]/index.js',
	},
	resolve: {
		...( defaultConfig.resolve || {} ),
	},
	module: {
		...( defaultConfig.module || {} ),
		rules: [
			// Disable fullySpecified for all .js/.mjs files so extensionless
			// imports work despite package.json "type": "module".
			{
				test: /\.m?jsx?$/,
				resolve: { fullySpecified: false },
			},
			...( defaultConfig.module?.rules || [] ),
		],
	},
	plugins: [
		...( defaultConfig.plugins || [] ).filter(
			( plugin ) => plugin.constructor.name !== 'CopyPlugin'
		),
		new CopyPlugin( { patterns: copyPatterns } ),
	],
};
