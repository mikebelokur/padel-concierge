import {
  useListMatches,
  useGetPlayerStats,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { MatchCard } from "@/components/MatchCard";
import { StatCard } from "@/components/StatCard";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: recentMatches, isLoading: matchesLoading, refetch } =
    useListMatches({ status: "open" });

  const { data: stats } = useGetPlayerStats(user?.id ?? 0, {
    query: { enabled: !!user?.id } as never,
  });

  const winRate =
    user && user.matchesPlayed > 0
      ? Math.round((user.wins / user.matchesPlayed) * 100)
      : 0;

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
          refreshing={matchesLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting()}
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {user?.name?.split(" ")[0] ?? "Player"}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.profileBtn,
            {
              backgroundColor: `${colors.primary}18`,
              borderColor: `${colors.primary}44`,
              borderRadius: 22,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Text style={[styles.profileInitial, { color: colors.primary }]}>
            {user?.name?.[0]?.toUpperCase() ?? "P"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.levelRow}>
        <View
          style={[
            styles.levelBadge,
            {
              backgroundColor: `${colors.primary}22`,
              borderColor: `${colors.primary}55`,
              borderRadius: 8,
            },
          ]}
        >
          <Text style={[styles.levelLabel, { color: colors.mutedForeground }]}>
            LEVEL
          </Text>
          <Text style={[styles.levelValue, { color: colors.primary }]}>
            {user?.level ?? "—"}
          </Text>
        </View>
        {user?.verified ? (
          <View
            style={[
              styles.verifiedBadge,
              {
                backgroundColor: `${colors.accent}18`,
                borderColor: `${colors.accent}44`,
                borderRadius: 8,
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

      <View style={styles.statsRow}>
        <StatCard
          label="Matches"
          value={stats?.matchesPlayed ?? user?.matchesPlayed ?? 0}
          accent
        />
        <StatCard label="Wins" value={user?.wins ?? 0} />
        <StatCard label="Win Rate" value={`${winRate}%`} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.findBtn,
          {
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
            opacity: pressed ? 0.88 : 1,
            transform: pressed ? [{ scale: 0.98 }] : [],
          },
        ]}
        onPress={() => router.push("/(tabs)/matches")}
        testID="find-match-btn"
      >
        <Feather name="search" size={18} color={colors.primaryForeground} />
        <Text style={[styles.findBtnText, { color: colors.primaryForeground }]}>
          Find a Match
        </Text>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Open Matches
      </Text>

      {matchesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !recentMatches || recentMatches.length === 0 ? (
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
          <Feather name="inbox" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No open matches right now
          </Text>
        </View>
      ) : (
        recentMatches.slice(0, 5).map((m) => <MatchCard key={m.id} match={m} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 13,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  levelRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: -4,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  levelLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
  },
  levelValue: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  findBtn: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  findBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    flex: 1,
    textAlign: "center",
    marginLeft: -28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
    marginBottom: -8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
