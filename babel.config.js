module.exports = function(api) {
  api.cache(true);
  // babel-preset-expo adds react-native-worklets/plugin (needed by Reanimated 4) automatically.
  return {
    presets: ['babel-preset-expo'],
  };
};
