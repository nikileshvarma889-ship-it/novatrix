import React, { Suspense, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { NotoSerifTelugu_400Regular, NotoSerifTelugu_600SemiBold } from "@expo-google-fonts/noto-serif-telugu";
import { NotoSansTelugu_400Regular, NotoSansTelugu_600SemiBold } from "@expo-google-fonts/noto-sans-telugu";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import { DB_NAME, migrate } from "../db/schema";
import { fonts } from "../theme/typography";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Loading() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FBF7EF" }}><ActivityIndicator color="#1F4D3A" /></View>;
}

function Navigator() {
  const { c, isDark, ready } = useTheme();
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return <Loading />;
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: c.bg }, headerShadowVisible: false, headerTintColor: c.primary,
        headerTitleStyle: { fontFamily: fonts.uiBold, color: c.text }, contentStyle: { backgroundColor: c.bg }, animation: "slide_from_right",
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="read/[book]/[chapter]" options={{ title: "" }} />
        <Stack.Screen name="prayer/index" options={{ title: "Prayer Journal" }} />
        <Stack.Screen name="prayer/[id]" options={{ title: "Prayer" }} />
        <Stack.Screen name="history" options={{ title: "Reading History" }} />
        <Stack.Screen name="calendar" options={{ title: "Christian Calendar" }} />
        <Stack.Screen name="about" options={{ title: "About Vachanam" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy Policy" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    NotoSerifTelugu_400Regular, NotoSerifTelugu_600SemiBold, NotoSansTelugu_400Regular, NotoSansTelugu_600SemiBold,
  });
  if (!loaded && !error) return <Loading />;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Suspense fallback={<Loading />}>
          <SQLiteProvider databaseName={DB_NAME} onInit={migrate} useSuspense>
            <Navigator />
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
