import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
// No GPU is required: WebGL runs on the CPU through SwiftShader/ANGLE.
Config.setChromiumOpenGlRenderer("swangle");
if (process.env.REMOTION_BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
if (process.env.REMOTION_CONCURRENCY) Config.setConcurrency(parseInt(process.env.REMOTION_CONCURRENCY, 10));
