import React from "react";
import { Tabs } from "expo-router/js-tabs";
import { useTheme } from "../../theme/ThemeProvider";
import { Icon, type IconName } from "../../components/Icon";
import { fonts } from "../../theme/typography";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "bible", title: "Bible", icon: "book" },
  { name: "notes", title: "Notes", icon: "note" },
  { name: "bookmarks", title: "Bookmarks", icon: "bookmark" },
  { name: "settings", title: "Settings", icon: "settings" },
];

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.textMuted,
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 64, paddingTop: 6, paddingBottom: 8 },
      tabBarLabelStyle: { fontFamily: fonts.uiMedium, fontSize: 11.5 },
      sceneStyle: { backgroundColor: c.bg },
    }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ color, focused }) => <Icon name={t.icon} color={String(color)} size={23} strokeWidth={focused ? 2 : 1.6} />, tabBarAccessibilityLabel: t.title }} />
      ))}
    </Tabs>
  );
}
