const config = require('./app.json').expo;
const api = process.env.EXPO_PUBLIC_API_URL || '';
const localTesting = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?\//.test(api);
module.exports = {
  ...config,
  plugins: config.plugins.map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
    ? [plugin[0], { ...plugin[1], ...(localTesting ? { android: { ...plugin[1].android, usesCleartextTraffic: true } } : {}) }]
    : plugin),
};
