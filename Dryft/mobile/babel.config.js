module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@hooks': './src/hooks',
            '@store': './src/store',
            '@api': './src/api',
            '@utils': './src/utils',
            '@types': './src/types',
            '@navigation': './src/navigation',
            '@i18n': './src/i18n',
            '@assets': './assets',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
