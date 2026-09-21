const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = function (middleware, server) {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
  return function isolatedMiddleware(request, response, next) {
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(request, response, next);
  };
};
module.exports = withNativeWind(config, { input: './src/global.css' });
