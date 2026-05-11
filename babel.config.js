/**
 * Babel config — only loaded by tools that look for it explicitly
 * (Jest does, via babel-jest; Metro has its own resolver that falls
 * back to babel-preset-expo when no project config is present, which
 * matches what we declare here, so the production bundle is
 * unchanged).
 *
 * The `dynamic-import-node` plugin is test-only: Jest runs in
 * CommonJS by default and the store's `await import('./screen-time')`
 * call otherwise throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG.
 * Production Metro builds don't need the transform — Metro handles
 * dynamic imports natively.
 */
module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: ['babel-preset-expo'],
    plugins: isTest ? ['babel-plugin-dynamic-import-node'] : [],
  };
};
