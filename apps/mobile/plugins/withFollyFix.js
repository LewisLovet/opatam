/**
 * Expo config plugin to fix folly/coro/Coroutine.h not found
 * (Xcode 26 + React Native 0.81)
 *
 * Adds -DFOLLY_CFG_NO_COROUTINES=1 to all pod targets.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withFollyFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const snippet = `
    # Fix: folly/coro/Coroutine.h not found (Xcode 26 + RN 0.81)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        cflags = bc.build_settings['OTHER_CPLUSPLUSFLAGS'] || ['$(inherited)']
        cflags = [cflags] if cflags.is_a?(String)
        unless cflags.include?('-DFOLLY_CFG_NO_COROUTINES=1')
          cflags << '-DFOLLY_CFG_NO_COROUTINES=1'
          bc.build_settings['OTHER_CPLUSPLUSFLAGS'] = cflags
        end
      end
    end`;

      // Only add if not already present
      if (!podfile.includes('DFOLLY_CFG_NO_COROUTINES')) {
        // Insert before the closing `end` of post_install
        podfile = podfile.replace(
          /(\s*react_native_post_install\([\s\S]*?\))/,
          `$1\n${snippet}`
        );
        fs.writeFileSync(podfilePath, podfile, 'utf8');
      }

      return cfg;
    },
  ]);
}

module.exports = withFollyFix;
