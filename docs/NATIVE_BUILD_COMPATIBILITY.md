# Native build compatibility

`node infrastructure/triton-native.mjs ios --device 'Triton42 Latest iPhone'`
refreshes the staging sources and runs Expo prebuild before compiling. Prebuild
updates existing generated projects without clearing installed application data.

Expo modules are compiled from source (`ios.usePrecompiledModules: false` in the
`expo-build-properties` plugin). The SDK 57 precompiled ExpoModulesCore framework
could not be imported with the installed Xcode 27.1 / Swift 6.4 toolchain.

The pnpm patch for `expo-modules-jsi@57.1.1` makes two build-script corrections:

- Include the Xcode build in the framework cache hash. Xcode releases can use the
  same Swift compiler version while shipping different SDKs.
- Strip private C++ extensions from generated public Swift interfaces for both
  `__ObjC.` and Swift 6.4's `__ObjC::` spelling. The upstream script already strips
  these extensions for the older spelling.

The patch is applied by frozen-lockfile installs, including fresh staging builds.
No manual edits to generated frameworks are needed. Reassess this patch when
upgrading ExpoModulesJSI to a version with the upstream corrections.

The universal app uses `index.js` as its entry point. It registers calendar
background tasks before importing `expo-router/entry`, so Android headless
launches can find Expo TaskManager before React renders the first screen.

Native staging excludes the generated `frontend/public/triton` web export;
that output is not a native build input and may be replaced during web publishing.
