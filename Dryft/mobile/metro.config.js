const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable source maps for debugging
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  sourceMap: {
    includeSources: true,
  },
};

// Add support for additional file extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// Asset extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'db',
  'mp3',
  'ttf',
  'otf',
  'wav',
  'lottie',
  'json',
];

module.exports = config;
