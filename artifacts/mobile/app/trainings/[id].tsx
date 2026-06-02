import {
  useListGroupTrainings,
  useListGroupTrainingBookings,
  getListGroupTrainingsQueryKey,
  getListGroupTrainingBookingsQueryKey,
} from "@workspace/api-client-react";
import type { TrainingBookingWithPlayer } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { formatMatchDateTime } from "@/lib/datetime";
import { CATEGORY_COLORS, isCoachUser } from "@/lib/trainings";

const GOLD = "#D4AF37";

export default function TrainingRosterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const lang = user?.language ?? "ru";
  const topPad = Platform.OS === "web" ? 0 : 0;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const coach = isCoachUser(user);

  const { data: trainings } = useListGroupTrainings(undefined, {
    query: {
      enabled: coach,
      queryKey: getListGroupTrainingsQueryKey(undefined),
    },
  });
  const {
    data: bookings,
    isLoading,
    refetch,
  } = useListGroupTrainingBookings(id ?? "", {
    query: {
      enabled: coach && !!id,
      queryKey: getListGroupTrainingBookingsQueryKey(id ?? ""),
    },
  });

  if (authLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (!coach) {
    return <Redirect href="/(tabs)/trainings" />;
  }

  const training = (trainings ?? []).find((tr) => tr.id === id);
  const activeBookings = (bookings ?? []).filter(
    (b) => b.status !== "cancelled",
  );

  const catColor = training
    ? (CATEGORY_COLORS[training.category] ?? GOLD)
    : GOLD;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 32 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: t("trainingsCoach.roster") }} />

      {training ? (
        <View
          style={[
            styles.summary,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View
            style={[
              styles.catBadge,
              {
                borderColor: `${catColor}55`,
                backgroundColor: `${catColor}1f`,
              },
            ]}
          >
            <Text style={[styles.catBadgeText, { color: catColor }]}>
              {training.category}
            </Text>
          </View>
          <Text style={[styles.summaryDate, { color: colors.foreground }]}>
            {formatMatchDateTime(training.dateTime, null, lang, "long")}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {training.courtName}
            </Text>
          </View>
          <Text style={[styles.spots, { color: colors.mutedForeground }]}>
            {t("trainingsCoach.spots", {
              booked: activeBookings.length,
              max: training.maxParticipants,
            })}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t("trainingsCoach.roster")}
      </Text>

      {isLoading && activeBookings.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activeBookings.length > 0 ? (
        <View style={styles.list}>
          {activeBookings.map((b: TrainingBookingWithPlayer) => (
            <View
              key={b.id}
              testID={`roster-${b.id}`}
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
                style={[styles.avatar, { backgroundColor: `${GOLD}26` }]}
              >
                <Text style={[styles.avatarText, { color: GOLD }]}>
                  {b.player?.name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.playerName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {b.player?.name ?? "—"}
                </Text>
                {b.player?.phone ? (
                  <Text
                    style={[
                      styles.playerMeta,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {b.player.phone}
                  </Text>
                ) : null}
              </View>
              {b.player?.level ? (
                <View
                  style={[styles.levelPill, { backgroundColor: `${GOLD}1f` }]}
                >
                  <Text style={[styles.levelText, { color: GOLD }]}>
                    {b.player.level}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t("trainingsCoach.noBookings")}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, gap: 16 },
  summary: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  catBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catBadgeText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  summaryDate: {
    fontSize: 17,
    fontWeight: "600" as const,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metaText: {
    fontSize: 13,
    flex: 1,
  },
  spots: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  list: { gap: 10 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  playerMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  levelPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 24,
    textAlign: "center",
  },
});
