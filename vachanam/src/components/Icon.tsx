import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Hand-drawn line icons (24px grid) so the app carries no icon-font dependency. */
export type IconName = "home" | "book" | "note" | "bookmark" | "settings" | "sun" | "history" | "pray" | "devotional" | "chevron" | "back" | "plus" | "check" | "trash" | "info" | "shield" | "bell" | "user" | "search" | "text" | "moon" | "globe" | "calendar" | "spark" | "send" | "stop" | "underline" | "copy" | "share" | "star" | "folder" | "close" | "bookmarkFilled";
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
  underline: (c) => <Path d="M7 4.5v6.5a5 5 0 0 0 10 0V4.5M5.5 20h13" stroke={c} />,
  copy: (c) => <><Rect x="8.5" y="8.5" width="11" height="11" rx="2" stroke={c} /><Path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" stroke={c} /></>,
  share: (c) => <><Circle cx="17.5" cy="5.5" r="2.5" stroke={c} /><Circle cx="6.5" cy="12" r="2.5" stroke={c} /><Circle cx="17.5" cy="18.5" r="2.5" stroke={c} /><Path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4" stroke={c} /></>,
  star: (c) => <Path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" stroke={c} />,
  folder: (c) => <Path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18zM12 11.5v5M9.5 14h5" stroke={c} />,
  close: (c) => <Path d="M6 6l12 12M18 6L6 18" stroke={c} />,
  bookmarkFilled: (c) => <Path d="M6.5 3.5h11a.5.5 0 0 1 .5.5v16.5l-6-4-6 4V4a.5.5 0 0 1 .5-.5z" stroke={c} fill={c} />,
  spark: (c) => <Path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" stroke={c} />,
  send: (c) => <Path d="M4.5 12l15-7.5-5 15-2.5-6zM12 13.5l7.5-9" stroke={c} />,
  stop: (c) => <Rect x="7" y="7" width="10" height="10" rx="2" stroke={c} />,
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
