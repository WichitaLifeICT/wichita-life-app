// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // public/golf/supabase-js-*.js is Supabase's own published build, copied in for the golf game.
    ignores: ['dist/*', 'public/golf/supabase-js-*.js'],
  },
]);
