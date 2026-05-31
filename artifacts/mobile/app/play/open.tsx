import {
  useListOpenPlayMatches,
  useRequestJoinPlayMatch,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";

type MatchKind = "unranked" | "competitive" | "personal";

const KIND_ICON: Record<MatchKind, string> = {
  unranked: "🎾",
  competitive: "🏆",
  personal: "🎯",
};

export default function PlayOpenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [requested, setRequested] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: matches, isLoading, refetch } = useListOpenPlayMatches();
  const requestJoin = useRequestJoinPlayMatch();

  async function handleRequest(id: number) {
    if (busyId) return;
    setBusyId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await requestJoin.mutateAsync({ id });
      setRequested((prev) => new Set(prev).add(id));
    } catch {
      /* non-fatal */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t("playFlow.openMatches") }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <View>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            {t("playFlow.openMatches")}
          </Text>
          <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
            {t("playFlow.openMatchesDesc")}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !matches || matches.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text style={styles.emptyIcon}>🌐</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("playFlow.noOpenMatches")}
            </Text>
          </View>
        ) : (
          matches.map((m) => {
            const kind = (m.kind ?? "unranked") as MatchKind;
            const done = requested.has(m.id);
            const full = m.spotsLeft <= 0;
            return (
              <View
                key={m.id}
                testID={`open-match-${m.id}`}
                style={[
                  styles.matchCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.matchHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.matchTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {t(`playFlow.kind.${kind}.title`)} · {m.leaderName ?? "—"}
                    </Text>
                    <Text
                      style={[styles.matchSub, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {m.clubName} · {m.date} {m.time}
                    </Text>
                    {kind === "personal" && m.goal ? (
                      <Text style={[styles.matchGoal, { color: colors.mutedForeground }]}>
                        🎯 {t(`playFlow.goalOptions.${m.goal}`)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.matchIcon}>{KIND_ICON[kind]}</Text>
                </View>
                <View style={styles.matchFooter}>
                  <Text style={[styles.counter, { color: colors.primary }]}>
                    {m.participantCount}/{m.maxPlayers}
                  </Text>
                  <Pressable
                    testID={`button-request-${m.id}`}
                    style={({ pressed }) => [
                      styles.joinBtn,
                      {
                        backgroundColor: done || full ? colors.muted : colors.primary,
                        borderRadius: colors.radius,
                        opacity:
                          busyId === m.id || done || full ? 0.6 : pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => handleRequest(m.id)}
                    disabled={busyId === m.id || done || full}
                  >
                    {busyId === m.id ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text
                        style={[
                          styles.joinText,
                          {
                            color:
                              done || full
                                ? colors.mutedForeground
                                : colors.primaryForeground,
                          },
                        ]}
                      >
                        {full
                          ? t("playFlow.matchFull")
                          : done
                            ? t("playFlow.requested")
                            : t("playFlow.requestJoin")}
                      </Text>
                    )}
                  </Pressable>
                </View>
                {done ? (
                  <View style={styles.requestedNote}>
                    <Feather name="clock" size={12} color={colors.accent} />
                    <Text style={[styles.requestedText, { color: colors.accent }]}>
                      {t("playFlow.requestSentDesc")}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 16 },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyCard: {
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  matchCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  matchSub: {
    fontSize: 12,
    marginTop: 3,
  },
  matchGoal: {
    fontSize: 12,
    marginTop: 4,
  },
  matchIcon: { fontSize: 24 },
  matchFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  joinBtn: {
    paddingHorizontal: 18,
    height: 40,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  joinText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  requestedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requestedText: {
    fontSize: 12,
  },
});
