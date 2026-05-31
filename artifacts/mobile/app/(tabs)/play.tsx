import {
  useListMyPlayMatchInvites,
  useListMyPlayMatches,
  useRespondPlayMatchInvite,
} from "@workspace/api-client-react";
import type { PlayMatchInvite, PlayMatchMine } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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

const KINDS: MatchKind[] = ["unranked", "competitive", "personal"];

const KIND_META: Record<MatchKind, { icon: string; accent: string }> = {
  unranked: { icon: "🎾", accent: "#7dd3fc" },
  competitive: { icon: "🏆", accent: "#D4AF37" },
  personal: { icon: "🎯", accent: "#c4b5fd" },
};

export default function PlayHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const {
    data: invites,
    isLoading,
    refetch,
  } = useListMyPlayMatchInvites();
  const {
    data: myMatches,
    isLoading: myMatchesLoading,
    refetch: refetchMine,
  } = useListMyPlayMatches();
  const respond = useRespondPlayMatchInvite();

  async function handleRespond(inv: PlayMatchInvite, accept: boolean) {
    if (busyId) return;
    setBusyId(inv.matchId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await respond.mutateAsync({ id: inv.matchId, data: { accept } });
      await Promise.all([refetch(), refetchMine()]);
      if (accept) router.push(`/play/match/${inv.matchId}`);
    } catch {
      /* non-fatal */
    } finally {
      setBusyId(null);
    }
  }

  function openMatch(id: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/play/match/${id}`);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 100 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading || myMatchesLoading}
          onRefresh={() => {
            refetch();
            refetchMine();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          {t("playFlow.hubTitle")}
        </Text>
        <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
          {t("playFlow.hubSubtitle")}
        </Text>
      </View>

      {invites && invites.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {t("playFlow.invitationsTitle")}
          </Text>
          {invites.map((inv) => {
            const kind = (inv.match.kind ?? "unranked") as MatchKind;
            return (
              <View
                key={inv.id}
                testID={`invite-${inv.matchId}`}
                style={[
                  styles.inviteCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: `${colors.primary}55`,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.inviteHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.inviteTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {inv.match.leaderName ?? "—"} · {t(`playFlow.kind.${kind}.title`)}
                    </Text>
                    <Text
                      style={[styles.inviteSub, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {inv.match.clubName} · {inv.match.date} {inv.match.time} ·{" "}
                      {inv.match.participantCount}/{inv.match.maxPlayers}
                    </Text>
                  </View>
                  <Text style={styles.inviteIcon}>{KIND_META[kind].icon}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable
                    testID={`button-accept-${inv.matchId}`}
                    style={({ pressed }) => [
                      styles.acceptBtn,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: colors.radius,
                        opacity: busyId === inv.matchId ? 0.6 : pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => handleRespond(inv, true)}
                    disabled={busyId === inv.matchId}
                  >
                    <Text style={[styles.acceptText, { color: colors.primaryForeground }]}>
                      {t("playFlow.accept")}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`button-decline-${inv.matchId}`}
                    style={({ pressed }) => [
                      styles.declineBtn,
                      {
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        opacity: busyId === inv.matchId ? 0.6 : pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => handleRespond(inv, false)}
                    disabled={busyId === inv.matchId}
                  >
                    <Text style={[styles.declineText, { color: colors.mutedForeground }]}>
                      {t("playFlow.decline")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t("playFlow.myMatchesTitle")}
        </Text>
        {myMatches && myMatches.length > 0 ? (
          myMatches.map((m: PlayMatchMine) => {
            const kind = (m.kind ?? "unranked") as MatchKind;
            return (
              <Pressable
                key={m.id}
                testID={`my-match-${m.id}`}
                style={({ pressed }) => [
                  styles.myMatchCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: pressed ? `${colors.primary}66` : colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
                onPress={() => openMatch(m.id)}
              >
                <Text style={styles.myMatchIcon}>{KIND_META[kind].icon}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.kindTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {m.clubName} · {t(`playFlow.kind.${kind}.title`)}
                  </Text>
                  <Text
                    style={[styles.kindDesc, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {m.date} {m.time} · {m.participantCount}/{m.maxPlayers} ·{" "}
                    {m.myRole === "leader"
                      ? t("playFlow.roleLeader")
                      : t("playFlow.roleJoined")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>
            );
          })
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {t("playFlow.myMatchesEmpty")}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t("playFlow.createTitle")}
        </Text>
        {KINDS.map((kind) => (
          <Pressable
            key={kind}
            testID={`card-kind-${kind}`}
            style={({ pressed }) => [
              styles.kindCard,
              {
                backgroundColor: colors.card,
                borderColor: pressed ? `${colors.primary}66` : colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push(`/play/create/${kind}`);
            }}
          >
            <Text style={styles.kindIcon}>{KIND_META[kind].icon}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.kindTitle, { color: colors.foreground }]}>
                {t(`playFlow.kind.${kind}.title`)}
              </Text>
              <Text style={[styles.kindDesc, { color: colors.mutedForeground }]}>
                {t(`playFlow.kind.${kind}.desc`)}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t("playFlow.browseTitle")}
        </Text>
        <Pressable
          testID="card-open-matches"
          style={({ pressed }) => [
            styles.browseCard,
            {
              backgroundColor: colors.card,
              borderColor: pressed ? `${colors.primary}66` : colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          onPress={() => router.push("/play/open")}
        >
          <Text style={styles.browseIcon}>🌐</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.kindTitle, { color: colors.foreground }]}>
              {t("playFlow.openMatches")}
            </Text>
            <Text style={[styles.kindDesc, { color: colors.mutedForeground }]}>
              {t("playFlow.openMatchesDesc")}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  section: { gap: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inviteCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inviteTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  inviteSub: {
    fontSize: 12,
    marginTop: 3,
  },
  inviteIcon: { fontSize: 26 },
  inviteActions: {
    flexDirection: "row",
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  declineBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  declineText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  kindCard: {
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  kindIcon: { fontSize: 28 },
  kindTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  kindDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  browseCard: {
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  browseIcon: { fontSize: 24 },
  myMatchCard: {
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  myMatchIcon: { fontSize: 24 },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
