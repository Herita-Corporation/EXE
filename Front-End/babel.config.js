module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Resolves the "@/*" TypeScript path alias (tsconfig.json) at the
      // Metro/runtime level too — tsconfig "paths" only affects type
      // checking, not bundling, so this is required for "@/..." imports
      // to actually work in the app, not just pass `tsc`.
      [
        "module-resolver",
        {
          root: ["./"],
          alias: { "@": "./src" },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],
    ],
  };
};
