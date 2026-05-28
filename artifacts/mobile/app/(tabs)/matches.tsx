import {
  useListMatches,
  useGetMatchSuggestions,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
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
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/i18n";
import { MatchCard } from "@/components/MatchCard";

const LEVEL_FILTERS = ["All", "A", "B", "C+", "C", "D"] as const;

const SUGGESTION_COLORS: Record<string, string> = {
  best: "#D4AF37",
  balanced: "#22c55e",
  challenging: "#f97316",
  easy: "#3b82f6",
};

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedLevel, setSelectedLevel] = useState<string>("All");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: suggestions, isLoading: suggestionsLoading } =
    useGetMatchSuggestions(
      { userId: user?.id ?? 0 },
      { query: { enabled: !!user?.id } as never }
    );

  const matchParams =
    selectedLevel === "All" ? {} : { level: selectedLevel };

  const { data: matches, isLoading: matchesLoading, refetch } =
    useListMatches({ ...matchParams, status: "open" });

  const suggestionEntries = suggestions
    ? (["best", "balanced", "challenging", "easy"] as const).filter(
        (k) => suggestions[k] != null
      )
    : [];

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
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>
        {t("matches.title")}
      </Text>

      {suggestionEntries.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("matches.smartSuggestions")}
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            {t("matches.smartSub")}
          </Text>
          {suggestionEntries.map((key) => {
            const match = suggestions![key]!;
            return (
              <MatchCard
                key={`${key}-${match.id}`}
                match={match}
                tag={t(`matches.suggestions.${key}`)}
                tagColor={SUGGESTION_COLORS[key]}
              />
            );
          })}
        </View>
      ) : suggestionsLoading && !!user?.id ? (
        <View style={styles.loadingSmall}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {t("matches.loadingSuggestions")}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("matches.openMatches")}
          </Text>
          <Feather name="filter" size={16} color={colors.mutedForeground} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {LEVEL_FILTERS.map((lvl) => (
            <Pressable
              key={lvl}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor:
                    selectedLevel === lvl ? colors.primary : colors.card,
                  borderColor:
                    selectedLevel === lvl ? colors.primary : colors.border,
                  borderRadius: 20,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => setSelectedLevel(lvl)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color:
                      selectedLevel === lvl
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                  },
                ]}
              >
                {lvl === "All" ? t("matches.filterAll") : lvl}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {matchesLoading ? (
          <View style={styles.loadingContainer}>
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
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {t("matches.noMatches")}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {selectedLevel !== "All"
                ? t("matches.noLevelMatches", { level: selectedLevel })
                : t("matches.tryDifferent")}
            </Text>
          </View>
        ) : (
          matches.map((m) => <MatchCard key={m.id} match={m} />)
        )}
      </View>
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
  pageTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 13,
    marginTop: -6,
  },
  filterScroll: {
    marginHorizontal: -20,
  },
  filterContent: {
    gap: 8,
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    minWidth: 44,
    alignItems: "center",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  loadingSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyCard: {
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
