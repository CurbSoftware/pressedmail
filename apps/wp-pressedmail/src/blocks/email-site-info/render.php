<?php
/**
 * Email Site Info: Server-side rendering.
 *
 * Outputs WordPress site information as email-safe inline or block HTML.
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

$field       = sanitize_key( $attributes['field'] ?? 'site_name' );
$format      = sanitize_key( $attributes['format'] ?? 'inline' );
$date_format = sanitize_text_field( $attributes['dateFormat'] ?? 'F j, Y' );

$font = "Arial, Helvetica, 'Segoe UI', sans-serif";

// Resolve the field value.
switch ( $field ) {
	case 'site_name':
		$value = get_bloginfo( 'name' );
		break;
	case 'site_url':
		$value = home_url();
		break;
	case 'site_description':
		$value = get_bloginfo( 'description' );
		break;
	case 'admin_email':
		$value = get_bloginfo( 'admin_email' );
		break;
	case 'current_date':
		$value = wp_date( $date_format );
		break;
	default:
		$value = '';
		break;
}

if ( empty( $value ) ) {
	return;
}

if ( 'inline' === $format ) {
	// Inline: rendered as a simple span.
	if ( 'site_url' === $field ) {
		echo '<a href="' . esc_url( $value ) . '" style="font-family:' . esc_attr( $font ) . ';color:#0073aa;text-decoration:none;">' . esc_html( $value ) . '</a>';
	} elseif ( 'admin_email' === $field ) {
		echo '<a href="mailto:' . esc_attr( $value ) . '" style="font-family:' . esc_attr( $font ) . ';color:#0073aa;text-decoration:none;">' . esc_html( $value ) . '</a>';
	} else {
		echo '<span style="font-family:' . esc_attr( $font ) . ';">' . esc_html( $value ) . '</span>';
	}
} else {
	// Block: rendered as a table row with label.
	$labels = array(
		'site_name'        => __( 'Site Name', 'pressedmail' ),
		'site_url'         => __( 'Website', 'pressedmail' ),
		'site_description' => __( 'Description', 'pressedmail' ),
		'admin_email'      => __( 'Email', 'pressedmail' ),
		'current_date'     => __( 'Date', 'pressedmail' ),
	);

	$label = $labels[ $field ] ?? $field;

	echo '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">';
	echo '<tr>';
	echo '<td style="font-family:' . esc_attr( $font ) . ';font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;">' . esc_html( $label ) . '</td>';
	echo '</tr>';
	echo '<tr>';
	echo '<td style="font-family:' . esc_attr( $font ) . ';font-size:16px;color:#333333;">';

	if ( 'site_url' === $field ) {
		echo '<a href="' . esc_url( $value ) . '" style="color:#0073aa;text-decoration:none;">' . esc_html( $value ) . '</a>';
	} elseif ( 'admin_email' === $field ) {
		echo '<a href="mailto:' . esc_attr( $value ) . '" style="color:#0073aa;text-decoration:none;">' . esc_html( $value ) . '</a>';
	} else {
		echo esc_html( $value );
	}

	echo '</td>';
	echo '</tr>';
	echo '</table>';
}
