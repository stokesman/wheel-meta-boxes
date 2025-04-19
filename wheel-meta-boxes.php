<?php
/**
 * Plugin Name: Wheel meta boxes
 *
 * @package s8-wheel-meta-boxes
 */

namespace s8\WP\WheelMetaBoxes;

add_action( 'enqueue_block_assets', __NAMESPACE__ . '\\content_script' );
function content_script() {
	// Enqueues only on 'post' screen (avoiding site editor).
	if ( is_admin() && 'post' === get_current_screen()->base ) {
		wp_enqueue_script(
			's8-wheel-meta-boxes',
			plugins_url( 'wheel-meta-boxes.js', __FILE__ ),
			[
				'wp-data',
				'wp-editor',
				'wp-edit-post',
				'wp-preferences',
			],
			filemtime( plugin_dir_path( __FILE__ ) . 'wheel-meta-boxes.js' ),
			true,
		);
	}
}

add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\sidebar' );
function sidebar() {
	wp_enqueue_script(
		's8-wheel-meta-boxes-sidebar',
		plugins_url( 'sidebar.js', __FILE__ ),
		[
			'wp-components',
			'wp-compose',
			'wp-data',
			'wp-editor',
			'wp-plugins',
			'wp-preferences',
		],
		filemtime( plugin_dir_path( __FILE__ ) . 'sidebar.js' ),
		true
	);
	wp_enqueue_style(
		's8-wheel-meta-boxes-sidebar',
		plugins_url( 'sidebar.css', __FILE__ ),
		[],
		filemtime( plugin_dir_path( __FILE__ ) . 'sidebar.css' )
	);
}
