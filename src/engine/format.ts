import { useVideoConfig } from "remotion";

/** Layout helper so every scene adapts to 16:9 and 9:16. */
export const useFormat = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // Scale unit: 1 at 1920x1080 (landscape) and at 1080x1920 (vertical).
  const u = vertical ? width / 1080 : width / 1920;
  return { vertical, width, height, u };
};
