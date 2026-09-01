<?php
/**
 * Email Recent Posts: Server-side rendering.
 *
 * Outputs email-safe HTML (table-based, inline styles) with recent WordPress posts.
 * Rendered at send time so content is always current.
 *
 * @package PressedMail\Blocks
 * @since 2.5.0
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner block content (empty for dynamic blocks).
 * @var WP_Block $block      Block instance.
 */

defined( 'ABSPATH' ) || exit;

$post_count     = absint( $attributes['postCount'] ?? 3 );
$category       = sanitize_text_field( $attributes['category'] ?? '' );

// Restrict queryable post types to prevent data exposure.
$allowed_post_types = apply_filters( 'pressedmail_email_block_allowed_post_types', array( 'post', 'page' ) );
$raw_post_type      = sanitize_key( $attributes['postType'] ?? 'post' );
$post_type          = in_array( $raw_post_type, $allowed_post_types, true ) ? $raw_post_type : 'post';
$display_style  = sanitize_key( $attributes['displayStyle'] ?? 'cards' );
$show_excerpt   = (bool) ( $attributes['showExcerpt'] ?? true );
$show_thumbnail = (bool) ( $attributes['showThumbnail'] ?? true );
$excerpt_length = absint( $attributes['excerptLength'] ?? 55 );

$query_args = array(
	'post_type'      => $post_type,
	'posts_per_page' => $post_count,
	'post_status'    => 'publish',
	'orderby'        => 'date',
	'order'          => 'DESC',
);

if ( $category ) {
	$query_args['cat'] = absint( $category );
}

$posts = get_posts( $query_args );

if ( empty( $posts ) ) {
	return;
}

$font = "Arial, Helvetica, 'Segoe UI', sans-serif";

// Start output.
echo '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">';
echo '<tbody>';

foreach ( $posts as $index => $post_item ) {
	$title     = get_the_title( $post_item );
	$permalink = get_permalink( $post_item );
	$excerpt   = '';

	if ( $show_excerpt ) {
		$excerpt = wp_trim_words( wp_strip_all_tags( $post_item->post_excerpt ?: $post_item->post_content ), $excerpt_length, '...' );
	}

	$thumbnail_html = '';
	if ( $show_thumbnail && has_post_thumbnail( $post_item ) ) {
		$thumb_url      = get_the_post_thumbnail_url( $post_item, 'medium' );
		$thumbnail_html = sprintf(
			'<img src="%s" alt="%s" width="80" height="80" style="display:block;border-radius:4px;object-fit:cover;width:80px;height:80px;">',
			esc_url( $thumb_url ),
			$title
		);
	}

	$border_top = $index > 0 ? 'border-top:1px solid #eeeeee;' : '';

	if ( 'cards' === $display_style ) {
		echo '<tr>';
		echo '<td style="padding:12px 0;' . esc_attr( $border_top ) . '">';
		echo '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;">';
		echo '<tr>';

		if ( $thumbnail_html ) {
			echo '<td style="padding:12px;width:80px;vertical-align:top;">' . wp_kses_post( $thumbnail_html ) . '</td>';
		}

		echo '<td style="padding:12px;vertical-align:top;">';
		echo '<a href="' . esc_url( $permalink ) . '" style="font-family:' . esc_attr( $font ) . ';font-size:16px;font-weight:bold;color:#1a1a1a;text-decoration:none;line-height:1.3;">' . esc_html( $title ) . '</a>';
		if ( $excerpt ) {
			echo '<p style="margin:6px 0 0;font-family:' . esc_attr( $font ) . ';font-size:14px;color:#666666;line-height:1.4;">' . esc_html( $excerpt ) . '</p>';
		}
		echo '</td>';
		echo '</tr>';
		echo '</table>';
		echo '</td>';
		echo '</tr>';
	} elseif ( 'list' === $display_style ) {
		echo '<tr>';
		echo '<td style="padding:8px 0;' . esc_attr( $border_top ) . '">';
		echo '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
		echo '<tr>';
		echo '<td style="width:8px;vertical-align:top;padding-top:6px;"><div style="width:6px;height:6px;border-radius:50%;background-color:#0073aa;"></div></td>';
		echo '<td style="padding-left:8px;">';
		echo '<a href="' . esc_url( $permalink ) . '" style="font-family:' . esc_attr( $font ) . ';font-size:15px;color:#0073aa;text-decoration:none;">' . esc_html( $title ) . '</a>';
		if ( $excerpt ) {
			echo '<p style="margin:2px 0 0;font-family:' . esc_attr( $font ) . ';font-size:13px;color:#888888;line-height:1.3;">' . esc_html( $excerpt ) . '</p>';
		}
		echo '</td>';
		echo '</tr>';
		echo '</table>';
		echo '</td>';
		echo '</tr>';
	} else {
		// Minimal style.
		echo '<tr>';
		echo '<td style="padding:4px 0;' . esc_attr( $border_top ) . '">';
		echo '<a href="' . esc_url( $permalink ) . '" style="font-family:' . esc_attr( $font ) . ';font-size:14px;color:#0073aa;text-decoration:none;">' . esc_html( $title ) . '</a>';
		echo '</td>';
		echo '</tr>';
	}
}

echo '</tbody>';
echo '</table>';
