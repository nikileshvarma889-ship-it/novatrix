import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);

// Normally Remotion downloads its own headless Chrome on first render.
// On machines without internet access, point it at an installed one:
//   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}

// Optional: REMOTION_CONCURRENCY=4 npm run render -- <slug>
if (process.env.REMOTION_CONCURRENCY) {
  Config.setConcurrency(parseInt(process.env.REMOTION_CONCURRENCY, 10));
}
