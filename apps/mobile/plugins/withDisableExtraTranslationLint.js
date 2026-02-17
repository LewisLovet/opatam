const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Config plugin to disable ExtraTranslation lint check on Android.
 * iOS locale keys (CFBundle*, NS*UsageDescription) in locales/fr.json
 * get injected into Android strings.xml but have no default locale equivalent,
 * causing lint to fail with ExtraTranslation errors.
 */
module.exports = function withDisableExtraTranslationLint(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Check if already patched
    if (buildGradle.includes('ExtraTranslation')) {
      return config;
    }

    // Add lint disable inside android { } block
    const lintBlock = `
    lint {
        disable += "ExtraTranslation"
    }`;

    // Insert after the first "android {" line
    config.modResults.contents = buildGradle.replace(
      /android\s*\{/,
      `android {${lintBlock}`
    );

    return config;
  });
};
