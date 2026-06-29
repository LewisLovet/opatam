const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Configure Metro to resolve packages from the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Allow hierarchical lookup for transitive dependencies in monorepo
config.resolver.disableHierarchicalLookup = false;

// Keep heavy build outputs out of Metro's file map. watchFolders covers the
// whole monorepo, so without this Metro crawls/watches things like
// apps/web/.next (the Next.js webpack cache — can reach several GB while
// `next dev` runs), which stalls the bundler. None of these are ever needed
// by the mobile bundle.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ignoredDirs = [
  path.join(monorepoRoot, 'apps/web/.next'),
  path.join(monorepoRoot, 'apps/web/out'),
  path.join(monorepoRoot, 'functions/lib'),
  path.join(monorepoRoot, '.git'),
];
const extraBlock = ignoredDirs.map((dir) => new RegExp(`^${escapeRe(dir)}(/.*)?$`));
const existingBlock = config.resolver.blockList;
const existingBlockArr = existingBlock
  ? Array.isArray(existingBlock)
    ? existingBlock
    : [existingBlock]
  : [];
config.resolver.blockList = [...existingBlockArr, ...extraBlock];

module.exports = config;
