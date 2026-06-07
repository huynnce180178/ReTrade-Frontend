# ReTrade Front-End Application

This is the front-end user interface for the ReTrade Second-Hand Trading and Auction Platform.

## Resonance Luxe Design System

The application styling follows the Resonance Luxe luxury brand design specifications:

### Color Palette

| Palette Role | Hex Code | Visual Sample / Description |
| :--- | :--- | :--- |
| Primary | `#02241B` | Deep Pine Green (used for major headings, primary buttons, and solid text) |
| Secondary | `#065F46` | Classic Emerald Green (used for subheadings, active navigation states, and accents) |
| Tertiary | `#0B9485` | Turquoise / Teal (used for badges, secondary active indicators, and links) |
| Neutral | `#F5F5F5` | Neutral Warm Off-White (used for clean body backgrounds and light canvas areas) |
| Neutral Card | `#FFFFFF` | Pure White (used for glassmorphic/elevated grid containers and content cards) |

### Typography Guidelines

- Headline Font: Playfair Display (serif typeface, used for bold, luxury headers, badges, and marketing slogans)
- Body Font: Manrope (sans-serif, optimized for readability in details list, tables, inputs, and paragraphs)
- Label Font: Manrope (medium/bold weights, used for inputs labels, buttons, tables headings, and tags)

---

## Shared Grid Layout System

To keep responsive grid layouts uniform and avoid CSS bloat, the project utilizes a shared utility stylesheet:
- Path: `src/styles/responsive-grid.css`
- Imported globally in `src/index.css`.
- Reusable classes:
  - `grid-4-col`: Displays 4 columns on large screens, collapses to 2 columns on tablets (under 768px), and 1 column on mobile (under 576px). Excellent for stats blocks or product lists.
  - `grid-3-col`: Displays 3 columns on large screens, collapsing to 1 column on tablets/mobile (under 992px). Excellent for feature cards or listings.

---

## Responsive Header Design

The site header supports full responsiveness on viewports down to 375px:
- Under 1024px, the desktop navigation (`.header-nav`) is hidden and replaced by a mobile menu toggle button (hamburger icon).
- When expanded via the hamburger button, `.header-nav` slides down as a full-width overlay containing all primary navigation links.
- The search bar is split into two views to prevent overlap issues:
  - `desktop-only-search`: Visible only on desktop views.
  - `mobile-search-wrapper`: Embedded directly within the mobile navigation drawer to flow naturally above the menu links.
- Major actions (like "Subscription" and "Login/Register" links) are hidden from the primary header bar on mobile to avoid overflow and are rendered inside the mobile menu drawer instead.

---

## Development Setup

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

---

## Code Flow and Component Guidelines

This project follows a clean React + Vite structure. High-level execution flow:

- Entry: `src/main.jsx` mounts the React app into `index.html`.
- App Root: `src/App.jsx` handles core providers and routing:
  - `GoogleOAuthProvider` for Google OAuth integrations.
  - `AuthProvider` wraps global authentication state.
  - `ToastProvider` for notifications.
  - Defines routes with `MainLayout` as the top-level layout wrapper.
- Layout & Pages: `src/layouts/MainLayout/MainLayout.jsx` renders shared layout elements (Header and Footer) and uses `<Outlet />` to mount page routes.
- Pages Location: Individual pages are under `src/pages/Buyer/*` (Home, Login, Register, Product, Auction, Wishlist, MyAccount).
- API & Auth State: `src/context/AuthContext.jsx` maintains user state and maps API responses. `src/services/api.js` automatically manages Bearer tokens and handles expired token responses (401 status) by forcing a logout.
