import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Hand-drawn line icons (24px grid) so the app carries no icon-font dependency. */
export type IconName = "home" | "book" | "note" | "bookmark" | "settings" | "sun" | "history" | "pray" | "devotional" | "chevron" | "back" | "plus" | "check" | "trash" | "info" | "shield" | "bell" | "user" | "search" | "text" | "moon" | "globe" | "calendar";
const P: Record<IconName, (c: string) => React.ReactNode> = {
  home: (c) => <Path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1H15v-6h-6v6H4.5a1 1 0 0 1-1-1z" stroke={c} />,
  book: (c) => <Path d="M12 6.5C9.5 4.8 6.5 4.5 3.5 5v13c3-.5 6-.2 8.5 1.5 2.5-1.7 5.5-2 8.5-1.5V5c-3-.5-6-.2-8.5 1.5zM12 6.5v13" stroke={c} />,
  note: (c) => <><Path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12.5A.5.5 0 0 1 5.5 20V4a.5.5 0 0 1 .5-.5z" stroke={c} /><Path d="M14.5 3.5v4.5h4.5M8.5 12h7M8.5 15.5h7" stroke={c} /></>,
  bookmark: (c) => <Path d="M6.5 3.5h11a.5.5 0 0 1 .5.5v16.5l-6-4-6 4V4a.5.5 0 0 1 .5-.5z" stroke={c} />,
  settings: (c) => <><Circle cx="12" cy="12" r="3" stroke={c} /><Path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" stroke={c} /></>,
  sun: (c) => <><Circle cx="12" cy="12" r="4" stroke={c} /><Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke={c} /></>,
  moon: (c) => <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" stroke={c} />,
  history: (c) => <><Path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5" stroke={c} /><Path d="M12 7.5V12l3 2" stroke={c} /></>,
  pray: (c) => <Path d="M12 3.5c-1.2 2-2.2 4.5-2.2 7.5v4.5L6 19.5h6M12 3.5c1.2 2 2.2 4.5 2.2 7.5v4.5L18 19.5h-6M12 6v13.5" stroke={c} />,
  devotional: (c) => <><Path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" stroke={c} /><Path d="M11.5 8v6M9 10.5h5" stroke={c} /></>,
  chevron: (c) => <Path d="M9.5 6l6 6-6 6" stroke={c} />,
  back: (c) => <Path d="M14.5 6l-6 6 6 6" stroke={c} />,
  plus: (c) => <Path d="M12 5v14M5 12h14" stroke={c} />,
  check: (c) => <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} />,
  trash: (c) => <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 10.5v6M14 10.5v6" stroke={c} />,
  info: (c) => <><Circle cx="12" cy="12" r="8.5" stroke={c} /><Path d="M12 11v5.5M12 7.8v.4" stroke={c} /></>,
  shield: (c) => <Path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" stroke={c} />,
  bell: (c) => <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4" stroke={c} />,
  user: (c) => <><Circle cx="12" cy="8.5" r="3.8" stroke={c} /><Path d="M4.5 20c1-4 4-5.8 7.5-5.8s6.5 1.8 7.5 5.8" stroke={c} /></>,
  search: (c) => <><Circle cx="10.8" cy="10.8" r="6.3" stroke={c} /><Path d="M15.5 15.5l4.5 4.5" stroke={c} /></>,
  text: (c) => <Path d="M4.5 18.5L9 5.5l4.5 13M6 14.5h6M15 18.5l2.8-7.5 2.7 7.5M15.9 16.3h3.9" stroke={c} />,
  calendar: (c) => <><Path d="M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4" stroke={c} /><Path d="M12 12.5v5M9.5 14.5h5" stroke={c} /></>,
  globe: (c) => <><Circle cx="12" cy="12" r="8.5" stroke={c} /><Path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" stroke={c} /></>,
};
export function Icon({ name, size = 22, color, strokeWidth = 1.6 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name](color)}
    </Svg>
  );
}
export { Rect };
