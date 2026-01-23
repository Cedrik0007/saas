/**
 * FlaticonIcon Component
 * 
 * This component provides a consistent way to use Flaticon icons throughout the app.
 * 
 * Usage:
 * <FlaticonIcon name="user" size={16} color="#5a31ea" />
 * 
 * Note: Icons need to be downloaded from Flaticon (https://www.flaticon.com)
 * and placed in the src/assets/icons/ directory as SVG files.
 * 
 * Flaticon free icons require attribution. See: https://www.flaticon.com/terms-of-use
 */

import React from 'react';

// Icon mappings - these should be replaced with actual Flaticon SVG imports
// For now, this is a placeholder structure
const iconMap = {
  // User & Profile icons
  'user': null,
  'user-plus': null,
  'user-edit': null,
  
  // Communication icons
  'envelope': null,
  'phone': null,
  'whatsapp': null,
  
  // Financial icons
  'wallet': null,
  'dollar-sign': null,
  'credit-card': null,
  
  // Calendar & Date icons
  'calendar': null,
  'calendar-day': null,
  'calendar-week': null,
  
  // File & Document icons
  'file': null,
  'file-invoice': null,
  'file-alt': null,
  'id-card': null,
  
  // Status & Info icons
  'info-circle': null,
  'check-circle': null,
  'exclamation-circle': null,
  'exclamation-triangle': null,
  
  // Navigation icons
  'chevron-right': null,
  'chevron-down': null,
  'times': null,
  
  // Other icons
  'tag': null,
  'hashtag': null,
  'toggle-on': null,
  'eye': null,
  'paper-plane': null,
  'chart-line': null,
  'chart-bar': null,
  'users': null,
  'comments': null,
  'cog': null,
  'clock': null,
  'trash': null,
};

export function FlaticonIcon({ 
  name, 
  size = 16, 
  color = '#1a1a1a',
  className = '',
  style = {},
  ...props 
}) {
  // TODO: Replace this with actual Flaticon SVG imports
  // For now, this is a placeholder that will need to be populated with actual SVG content
  
  const iconSvg = iconMap[name];
  
  if (!iconSvg) {
    console.warn(`FlaticonIcon: Icon "${name}" not found. Please add it to the iconMap.`);
    return null;
  }
  
  return (
    <span
      className={`flaticon-icon flaticon-icon-${name} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        color: color,
        ...style
      }}
      {...props}
    >
      {/* TODO: Replace with actual SVG content from Flaticon */}
      {/* Example structure:
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="..." fill={color} />
      </svg>
      */}
    </span>
  );
}

/**
 * Helper function to get icon name from Font Awesome class name
 * This helps with migration from Font Awesome to Flaticon
 */
export function getFlaticonNameFromFontAwesome(faClass) {
  const mapping = {
    'fa-user': 'user',
    'fa-user-plus': 'user-plus',
    'fa-envelope': 'envelope',
    'fa-phone': 'phone',
    'fa-wallet': 'wallet',
    'fa-dollar-sign': 'dollar-sign',
    'fa-calendar': 'calendar',
    'fa-calendar-day': 'calendar-day',
    'fa-calendar-alt': 'calendar-day',
    'fa-calendar-week': 'calendar-week',
    'fa-credit-card': 'credit-card',
    'fa-hashtag': 'hashtag',
    'fa-info-circle': 'info-circle',
    'fa-file-alt': 'file-alt',
    'fa-file-invoice': 'file-invoice',
    'fa-id-card': 'id-card',
    'fa-check-circle': 'check-circle',
    'fa-exclamation-circle': 'exclamation-circle',
    'fa-exclamation-triangle': 'exclamation-triangle',
    'fa-chevron-right': 'chevron-right',
    'fa-chevron-down': 'chevron-down',
    'fa-times': 'times',
    'fa-tag': 'tag',
    'fa-toggle-on': 'toggle-on',
    'fa-eye': 'eye',
    'fa-paper-plane': 'paper-plane',
    'fa-chart-line': 'chart-line',
    'fa-chart-bar': 'chart-bar',
    'fa-users': 'users',
    'fa-comments': 'comments',
    'fa-cog': 'cog',
    'fa-clock': 'clock',
    'fa-trash': 'trash',
  };
  
  // Remove 'fa-' or 'fas fa-' prefix
  const cleanClass = faClass.replace(/^(fas|fab|far|fal|fad)\s+fa-?/, 'fa-');
  return mapping[cleanClass] || mapping[faClass] || null;
}










