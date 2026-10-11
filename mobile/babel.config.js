module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already adds the react-native-worklets (Reanimated)
    // plugin; listing it again here applied it twice.
    presets: ["babel-preset-expo"],
  };
};
