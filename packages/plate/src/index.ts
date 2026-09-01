/**
 * @kit/plate - Centralized Plate editor framework for PMCPPN.
 *
 * Re-exports the catalog-pinned `platejs` package so every consumer
 * (apps/dashboard, apps/web-*, apps/wp-*) shares one source of truth
 * for the Plate version. Per-plugin entry points live under
 * `@kit/plate/<plugin-name>` and `@kit/plate/<plugin-name>/react`.
 */
export * from 'platejs';
