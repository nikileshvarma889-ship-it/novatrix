// Learn more: expo-sqlite on web loads a WebAssembly build of SQLite, so Metro must ship .wasm files as assets.
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("wasm", "db");
module.exports = config;
