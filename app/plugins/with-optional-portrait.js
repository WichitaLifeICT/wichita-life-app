// The app is locked to portrait, which makes Android quietly require a portrait screen to install it.
// Google Play flags that ("android.hardware.screen.portrait"), so declare the feature as optional:
// the app still runs upright, and landscape-only devices (some Chromebooks and tablets) can install it.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] = manifest['uses-feature'] || []);
    const name = 'android.hardware.screen.portrait';
    const existing = features.find((f) => f.$ && f.$['android:name'] === name);
    if (existing) existing.$['android:required'] = 'false';
    else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    return cfg;
  });
};
