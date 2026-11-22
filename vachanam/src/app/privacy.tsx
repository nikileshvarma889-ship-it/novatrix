import React from "react";
import { Text } from "react-native";
import { Card, Screen, SectionHeader } from "../components/ui";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";

const SECTIONS: [string, string][] = [
  ["Summary", "Vachanam works without an account. Your notes, highlights, bookmarks, prayers and reading history are stored on your device. We don't sell data, show ads or use third-party trackers."],
  ["Data on your device", "Personal content is kept in a local database on your phone. Uninstalling the app removes it unless you have turned on cloud sync."],
  ["Optional account and sync", "If you choose to create an account, your email address and the personal content you create are stored with our database provider (Supabase) so you can use them on other devices. Access rules ensure only you can read your own data. You can delete your account and data at any time from Settings."],
  ["Notifications", "Daily verse reminders are scheduled on your device and only after you allow notifications. You can turn them off at any time."],
  ["Children", "Vachanam is suitable for all ages and doesn't knowingly collect personal information from children."],
  ["Changes and contact", "We'll update this page if anything changes. Before publishing, add the developer's contact email here (required by Google Play)."],
];

export default function Privacy() {
  const { c } = useTheme();
  return (
    <Screen padTop={false}>
      {SECTIONS.map(([h, b]) => (
        <React.Fragment key={h}>
          <SectionHeader title={h} />
          <Card><Text style={{ fontFamily: fonts.ui, fontSize: 14.5, lineHeight: 22, color: c.text }}>{b}</Text></Card>
        </React.Fragment>
      ))}
    </Screen>
  );
}
