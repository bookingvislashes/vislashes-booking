/**
 * Retail is switched off while the salon is booking-only.
 *
 * Flipping this back to `true` restores the shop grid, the cart in the header,
 * and the "Lash Products" nav link in a single edit. The components themselves
 * are left intact and simply not rendered, so bringing products back is a
 * config change rather than a rebuild from git history.
 */
export const PRODUCTS_ENABLED = false;
