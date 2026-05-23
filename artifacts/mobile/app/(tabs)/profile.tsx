import { useGetPlayerStats } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/StatCard";

type FeatherName = ComponentProps<typeof Feather>["name"];

const ARCHETYPE_LABELS: Record<string, { label: string; icon: FeatherName }> = {
  "pro-ambitious": { label: "Pro Ambitious", icon: "zap" },
  "competitive-improver": { label: "Competitive Improver", icon: "trending-up" },
  "balanced-competitor": { label: "Balanced Competitor", icon: "activity" },
  "social-enjoyer": { label: "Social Enjoyer", icon: "users" },
  "casual-recreational": { label: "Casual Recreational", icon: "sun" },
};

const LEVEL_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f97316",
  "C+": "#D4AF37",
  C: "#22c55e",
  D: "#3b82f6",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: stats, isLoading: statsLoading } = useGetPlayerStats(
    user?.id ?? 0,
    { query: { enabled: !!user?.id } as never }
  );

  const winRate =
    user && user.matchesPlayed > 0
      ? Math.round((user.wins / user.matchesPlayed) * 100)
      : 0;

  const archetypeKey = (user as Record<string, unknown> | null)?.[
    "archetype"
  ] as string | undefined;
  const archetype = archetypeKey ? ARCHETYPE_LABELS[archetypeKey] : null;
  const levelColor = LEVEL_COLORS[user?.level ?? "C"] ?? colors.mutedForeground;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const detailItems: { icon: FeatherName; label: string; value?: string | null }[] = [
    { icon: "target", label: "Goal", value: user?.goal },
    { icon: "zap", label: "Intensity", value: user?.intensity },
    { icon: "map-pin", label: "Location", value: user?.locationName },
    { icon: "globe", label: "Language", value: user?.language },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: levelColor,
              backgroundColor: `${levelColor}18`,
            },
          ]}
        >
          <Text style={[styles.avatarInitials, { color: levelColor }]}>
            {user?.name
              ?.split(" ")
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("") ?? "P"}
          </Text>
        </View>
        <Text style={[styles.playerName, { color: colors.foreground }]}>
          {user?.name ?? "Player"}
        </Text>
        <Text style={[styles.playerEmail, { color: colors.mutedForeground }]}>
          {user?.email ?? ""}
        </Text>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: `${levelColor}22`,
                borderColor: `${levelColor}55`,
                borderRadius: 6,
              },
            ]}
          >
            <Text style={[styles.levelText, { color: levelColor }]}>
              Level {user?.level ?? "—"}
            </Text>
          </View>

          {user?.verified ? (
            <View
              style={[
                styles.verifiedBadge,
                {
                  backgroundColor: `${colors.accent}18`,
                  borderColor: `${colors.accent}44`,
                  borderRadius: 6,
                },
              ]}
            >
              <Feather name="check-circle" size={12} color={colors.accent} />
              <Text style={[styles.verifiedText, { color: colors.accent }]}>
                Verified
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {archetype ? (
        <View
          style={[
            styles.archetypeCard,
            {
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}33`,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name={archetype.icon} size={20} color={colors.primary} />
          <View style={styles.archetypeInfo}>
            <Text
              style={[styles.archetypeLabel, { color: colors.mutedForeground }]}
            >
              ARCHETYPE
            </Text>
            <Text style={[styles.archetypeValue, { color: colors.primary }]}>
              {archetype.label}
            </Text>
          </View>
        </View>
      ) : null}

      {statsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Performance
          </Text>
          <View style={styles.statsRow}>
            <StatCard
              label="Matches"
              value={stats?.matchesPlayed ?? user?.matchesPlayed ?? 0}
              accent
              small
            />
            <StatCard label="Wins" value={user?.wins ?? 0} small />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Win Rate" value={`${winRate}%`} small />
            <StatCard
              label="Reliability"
              value={
                user?.verified
                  ? "High"
                  : (user?.matchesPlayed ?? 0) > 0
                  ? "Good"
                  : "—"
              }
              small
            />
          </View>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Details
        </Text>
        {detailItems
          .filter((item) => item.value)
          .map((item) => (
            <View
              key={item.label}
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
            >
              <Feather name={item.icon} size={16} color={colors.mutedForeground} />
              <Text
                style={[styles.infoLabel, { color: colors.mutedForeground }]}
              >
                {item.label}
              </Text>
              <Text
                style={[styles.infoValue, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.value}
              </Text>
            </View>
          ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.logoutBtn,
          {
            backgroundColor: `${colors.destructive}15`,
            borderColor: `${colors.destructive}44`,
            borderRadius: colors.radius,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={handleLogout}
        testID="logout-button"
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>
          Sign Out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  profileHeader: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 8,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  playerName: {
    fontSize: 24,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  playerEmail: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 4,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  levelText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  archetypeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  archetypeInfo: {
    gap: 3,
  },
  archetypeLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  archetypeValue: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  statsSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  infoSection: {
    gap: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: "right",
    fontWeight: "500" as const,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderWidth: 1,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
});
