import {
  useGetPlayMatchRoom,
  useRespondPlayMatchJoinRequest,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
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

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PlayMatchRoomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);

  const [copied, setCopied] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const {
    data: room,
    isLoading,
    error,
    refetch,
  } = useGetPlayMatchRoom(matchId, {
    query: { enabled: Number.isFinite(matchId) } as never,
  });
  const respondRequest = useRespondPlayMatchJoinRequest();

  async function handleRequest(requestId: number, approve: boolean) {
    if (respondRequest.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await respondRequest.mutateAsync({
        id: matchId,
        requestId,
        data: { approve },
      });
      await refetch();
    } catch {
      /* non-fatal */
    }
  }

  async function copyLink() {
    if (!room?.inviteToken) return;
    try {
      await Clipboard.setStringAsync(room.inviteToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* non-fatal */
    }
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("playFlow.hubTitle") }} />
        <View
          style={[
            styles.centered,
            { backgroundColor: colors.background, paddingTop: topPad },
          ]}
        >
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </>
    );
  }

  if (error || !room) {
    return (
      <>
        <Stack.Screen options={{ title: t("playFlow.hubTitle") }} />
        <View
          style={[
            styles.centered,
            { backgroundColor: colors.background, paddingTop: topPad },
          ]}
        >
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            {t("playFlow.notFound")}
          </Text>
          <Pressable
            style={[
              styles.retryBtn,
              { borderColor: colors.border, borderRadius: colors.radius },
            ]}
            onPress={() => router.back()}
          >
            <Text style={[styles.retryText, { color: colors.foreground }]}>
              {t("playFlow.back")}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  const kind = (room.kind ?? "unranked") as MatchKind;
  const isLeader = room.myRole === "leader";
  const slots = Array.from({ length: room.maxPlayers });
  const slotLabel =
    room.slotMinutes != null
      ? `${Math.floor(room.slotMinutes / 60)}${t("playFlow.hourShort")}${
          room.slotMinutes % 60
            ? ` ${room.slotMinutes % 60}${t("playFlow.minShort")}`
            : ""
        }`
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t(`playFlow.kind.${kind}.title`) }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroRow}>
          <Text style={styles.heroIcon}>{KIND_ICON[kind]}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              {t(`playFlow.kind.${kind}.title`)}
            </Text>
            <Text
              style={[styles.heroSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {room.clubName} · {room.date} {room.time}
            </Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
              {room.format}
            </Text>
          </View>
          {slotLabel ? (
            <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {slotLabel}
              </Text>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
              {t(`playFlow.visibility_${room.visibility}`)}
            </Text>
          </View>
        </View>

        {kind === "personal" && (room.goal || room.styleNote) ? (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            {room.goal ? (
              <View style={{ gap: 3 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  {t("playFlow.goal")}
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {t(`playFlow.goalOptions.${room.goal}`)}
                </Text>
              </View>
            ) : null}
            {room.styleNote ? (
              <View style={{ gap: 3 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  {t("playFlow.style")}
                </Text>
                <Text style={[styles.infoValue, { color: colors.mutedForeground }]}>
                  {room.styleNote}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {t("playFlow.roster")}
            </Text>
            <Text style={[styles.counter, { color: colors.primary }]}>
              {room.participantCount}/{room.maxPlayers}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {slots.map((_, i) => {
              const p = room.participants[i];
              if (!p) {
                return (
                  <View
                    key={`empty-${i}`}
                    testID={`slot-empty-${i}`}
                    style={[
                      styles.emptySlot,
                      { borderColor: colors.border, borderRadius: colors.radius },
                    ]}
                  >
                    <Feather name="plus" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                      {t("playFlow.openSlot")}
                    </Text>
                  </View>
                );
              }
              return (
                <View
                  key={p.userId}
                  testID={`participant-${p.userId}`}
                  style={[
                    styles.playerRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: `${colors.primary}1f` },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {initials(p.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.playerName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    {p.level ? (
                      <Text style={[styles.playerLevel, { color: colors.mutedForeground }]}>
                        {p.level}
                      </Text>
                    ) : null}
                  </View>
                  {p.role === "leader" ? (
                    <View
                      style={[styles.leaderBadge, { backgroundColor: `${colors.primary}26` }]}
                    >
                      <Text style={[styles.leaderText, { color: colors.primary }]}>
                        {t("playFlow.leader")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {isLeader && room.joinRequests.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {t("playFlow.requestsQueue")}
            </Text>
            <View style={{ gap: 8 }}>
              {room.joinRequests.map((r) => (
                <View
                  key={r.id}
                  testID={`join-request-${r.id}`}
                  style={[
                    styles.requestRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: `${colors.primary}44`,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.playerName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {r.name}
                    </Text>
                    {r.level ? (
                      <Text style={[styles.playerLevel, { color: colors.mutedForeground }]}>
                        {r.level}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    testID={`approve-${r.id}`}
                    style={({ pressed }) => [
                      styles.smallBtn,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: colors.radius,
                        opacity: respondRequest.isPending ? 0.6 : pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => handleRequest(r.id, true)}
                    disabled={respondRequest.isPending}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.primaryForeground }]}>
                      {t("playFlow.approve")}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`reject-${r.id}`}
                    style={({ pressed }) => [
                      styles.smallBtnOutline,
                      {
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        opacity: respondRequest.isPending ? 0.6 : pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => handleRequest(r.id, false)}
                    disabled={respondRequest.isPending}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.mutedForeground }]}>
                      {t("playFlow.reject")}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {isLeader && room.spotsLeft > 0 && room.inviteToken ? (
          <Pressable
            testID="button-copy-link"
            style={({ pressed }) => [
              styles.copyBtn,
              {
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={copyLink}
          >
            <Feather
              name={copied ? "check" : "link"}
              size={16}
              color={copied ? colors.accent : colors.foreground}
            />
            <Text
              style={[
                styles.copyText,
                { color: copied ? colors.accent : colors.foreground },
              ]}
            >
              {copied ? t("playFlow.linkCopied") : t("playFlow.copyLink")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  content: { padding: 20, gap: 20 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: { fontSize: 32 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 13,
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  infoCard: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 14,
  },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  counter: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  emptySlot: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13 },
  playerRow: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  playerLevel: {
    fontSize: 12,
    marginTop: 2,
  },
  leaderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  leaderText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  requestRow: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 14,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnOutline: {
    paddingHorizontal: 14,
    height: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  copyBtn: {
    height: 52,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  copyText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  errorText: { fontSize: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
});
