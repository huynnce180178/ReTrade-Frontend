// ReTrade Mobile UI & Responsive Design System Configuration

export const MOBILE_BREAKPOINTS = {
  xs: 320,  // Ultra-small mobile (iPhone SE 1st gen)
  sm: 576,  // Mobile standard (Android / iPhone standard)
  md: 768,  // Tablet portrait / Large mobile
  lg: 992,  // Tablet landscape / Small laptop
  xl: 1200, // Desktop standard
  '2xl': 1400,// Wide desktop
};

export const TOUCH_TARGET_MIN_SIZE = 44; // Minimum touch target in CSS pixels (WCAG 2.1 AAA / Apple Human Interface Guidelines)

export const MOBILE_TEST_VIEWPORTS = [
  { name: 'iPhone SE / Ultra Small', width: 320, height: 568 },
  { name: 'Android Compact', width: 360, height: 640 },
  { name: 'iPhone Standard (6/7/8/SE2)', width: 375, height: 667 },
  { name: 'iPhone 12/13/14 Pro', width: 390, height: 844 },
  { name: 'Pixel 7 / Galaxy S20+', width: 412, height: 915 },
  { name: 'iPhone 14/15 Pro Max', width: 430, height: 932 },
  { name: 'Mobile Landscape', width: 640, height: 360 },
];

export const MOBILE_TABLE_STRATEGIES = {
  SCROLL: 'scroll',   // Smooth horizontal scroll container
  STACK: 'stack',     // Flex column stack per row
  CARD: 'card',       // Transform table rows into responsive card items
};

export const MOBILE_CONFIG = {
  breakpoints: MOBILE_BREAKPOINTS,
  touchTargetMin: TOUCH_TARGET_MIN_SIZE,
  defaultTableStrategy: MOBILE_TABLE_STRATEGIES.SCROLL,
  navDrawerWidth: 280, // Default width for mobile navigation drawers
  maxModalMobileWidth: 'calc(100vw - 24px)',
  maxModalMobileHeight: '90vh',
};

/**
 * Checks if current viewport width is below mobile breakpoint
 * @param {number} width - Viewport width in pixels
 * @returns {boolean}
 */
export const isMobileViewport = (width = (typeof window !== 'undefined' ? window.innerWidth : 1200)) => {
  return width <= MOBILE_BREAKPOINTS.md;
};

/**
 * Gets active breakpoint name based on viewport width
 * @param {number} width - Viewport width in pixels
 * @returns {string} breakpoint name ('xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl')
 */
export const getActiveBreakpoint = (width = (typeof window !== 'undefined' ? window.innerWidth : 1200)) => {
  if (width < MOBILE_BREAKPOINTS.xs) return 'xs';
  if (width < MOBILE_BREAKPOINTS.sm) return 'xs';
  if (width < MOBILE_BREAKPOINTS.md) return 'sm';
  if (width < MOBILE_BREAKPOINTS.lg) return 'md';
  if (width < MOBILE_BREAKPOINTS.xl) return 'lg';
  if (width < MOBILE_BREAKPOINTS['2xl']) return 'xl';
  return '2xl';
};

export default MOBILE_CONFIG;
