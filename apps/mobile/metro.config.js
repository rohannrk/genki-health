const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro can see hoisted node_modules and workspace
// packages (e.g. @genki/ui).
config.watchFolders = [monorepoRoot];

// Resolve modules from both the local node_modules and the hoisted root.
// With node-linker=hoisted (see root .npmrc) dependencies live flat at the
// monorepo root, so no pnpm symlink workarounds are needed here.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Do NOT enable unstable_enablePackageExports — it breaks packages like
// @clerk/clerk-expo whose "exports" map has no "react-native" condition,
// causing Metro to fail even though a valid "main" entry exists.
// config.resolver.unstable_enablePackageExports = true;

/**
 * Under node-linker=hoisted, all dependencies live flat at the monorepo root's
 * node_modules — apps/mobile/node_modules only holds workspace packages.
 * Node resolution walks up and finds everything, but Metro's HMR server emits
 * a monorepo-root-relative entry path ("./node_modules/expo-router/entry") and
 * then resolves it from the PROJECT root, which has no node_modules/expo-router
 * — crashing on the first HMR registration. Redirect any such root-relative
 * "./node_modules/…" request to the monorepo root where the packages live.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("./node_modules/")) {
    const absoluteBase = path.join(monorepoRoot, moduleName.slice(2));
    const exts = (
      context.sourceExts ?? ["js", "jsx", "ts", "tsx", "json", "cjs", "mjs"]
    ).flatMap((e) => [`.ios.${e}`, `.native.${e}`, `.${e}`]);

    for (const ext of ["", ...exts]) {
      const candidate = `${absoluteBase}${ext}`;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { type: "sourceFile", filePath: candidate };
      }
    }
    for (const ext of exts) {
      const candidate = path.join(absoluteBase, `index${ext}`);
      if (fs.existsSync(candidate)) {
        return { type: "sourceFile", filePath: candidate };
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
