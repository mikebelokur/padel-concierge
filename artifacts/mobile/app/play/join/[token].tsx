import { useJoinPlayMatchByToken } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";

type JoinResult = { id?: number; pending?: boolean; matchId?: number };

export default function PlayJoinByTokenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const { token } = useLocalSearchParams<{ token: string }>();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const join = useJoinPlayMatchByToken();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (authLoading || !user || !token) return;
    attempted.current = true;
    join.mutate(
      { token },
      {
        onSuccess: (data) => {
          const result = data as JoinResult;
          if (result?.pending) {
            router.replace("/play/open");
            return;
          }
          if (typeof result?.id === "number") {
            router.replace(`/play/match/${result.id}`);
          }
        },
      },
    );
  }, [authLoading, user, token, join]);

  const containerStyle = [
    styles.centered,
    { backgroundColor: colors.background, paddingTop: topPad },
  ];

  // Awaiting auth state, or actively joining.
  if (authLoading || (user && (join.isPending || join.isIdle))) {
    return (
      <>
        <Stack.Screen options={{ title: t("playFlow.youreInvited") }} />
        <View style={containerStyle}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            {t("playFlow.joining")}
          </Text>
        </View>
      </>
    );
  }

  // Not signed in — prompt to authenticate.
  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: t("playFlow.youreInvited") }} />
        <View style={containerStyle}>
          <Text style={styles.icon}>🎾</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t("playFlow.youreInvited")}
          </Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            {t("playFlow.signInToJoin")}
          </Text>
          <Pressable
            testID="button-sign-in"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => router.replace("/login")}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
              {t("playFlow.signIn")}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  // Join failed — surface the error with a retry path.
  const errorBody = (join.error as { code?: string } | null)?.code;
  const errorMessage =
    errorBody === "MATCH_FULL"
      ? t("playFlow.matchFull")
      : errorBody === "MATCH_CLOSED"
        ? t("playFlow.matchClosed")
        : t("playFlow.error");

  return (
    <>
      <Stack.Screen options={{ title: t("playFlow.youreInvited") }} />
      <View style={containerStyle}>
        <Feather name="alert-circle" size={32} color={colors.destructive} />
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          {errorMessage}
        </Text>
        <Pressable
          testID="button-back"
          style={[
            styles.outlineBtn,
            { borderColor: colors.border, borderRadius: colors.radius },
          ]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={[styles.outlineText, { color: colors.foreground }]}>
            {t("playFlow.back")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  icon: { fontSize: 44 },
  title: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryBtn: {
    paddingHorizontal: 24,
    height: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  outlineBtn: {
    borderWidth: 1,
    paddingHorizontal: 24,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
