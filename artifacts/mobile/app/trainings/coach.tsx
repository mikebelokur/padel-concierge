import {
  useListGroupTrainings,
  getListGroupTrainingsQueryKey,
} from "@workspace/api-client-react";
import type { GroupTraining } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, router, Stack } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { formatMatchDateTime } from "@/lib/datetime";
import { CATEGORY_COLORS, isCoachUser } from "@/lib/trainings";

const GOLD = "#D4AF37";

const STATUS_COLORS: Record<string, string> = {
  open: "#4ade80",
  full: GOLD,
  closed: "#94a3b8",
  scheduled: "#7dd3fc",
  cancelled: "#f87171",
  completed: "#94a3b8",
};

export default function CoachTrainingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();

  const lang = user?.language ?? "ru";
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const {
    data: trainings,
    isLoading,
    refetch,
  } = useListGroupTrainings(undefined, {
    query: {
      enabled: isCoachUser(user),
      queryKey: getListGroupTrainingsQueryKey(undefined),
    },
  });

  if (authLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (!isCoachUser(user)) {
    return <Redirect href="/(tabs)/trainings" />;
  }

  const sorted = (trainings ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
    );

  function renderCard(training: GroupTraining) {
    const catColor = CATEGORY_COLORS[training.category] ?? GOLD;
    const statusColor = STATUS_COLORS[training.status] ?? colors.mutedForeground;
    return (
      <Pressable
        key={training.id}
        testID={`coach-training-${training.id}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          router.push(`/trainings/${training.id}`);
        }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: pressed ? `${colors.primary}66` : colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.catBadge,
              { borderColor: `${catColor}55`, backgroundColor: `${catColor}1f` },
            ]}
          >
            <Text style={[styles.catBadgeText, { color: catColor }]}>
              {training.category}
            </Text>
          </View>
          <View
            style={[styles.statusPill, { backgroundColor: `${statusColor}1f` }]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`trainingsCoach.statusPill.${training.status}`)}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardDate, { color: colors.foreground }]}>
          {formatMatchDateTime(training.dateTime, null, lang, "long")}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text
            style={[styles.metaText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {training.courtName}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.spots, { color: colors.mutedForeground }]}>
            {t("trainingsCoach.spots", {
              booked: training.bookedCount,
              max: training.maxParticipants,
            })}
          </Text>
          <View style={styles.rosterLink}>
            <Text style={[styles.rosterText, { color: colors.primary }]}>
              {t("trainingsCoach.roster")}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.primary} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t("trainingsCoach.title") }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 110 },
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
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t("trainingsCoach.subtitle")}
        </Text>

        {isLoading && sorted.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : sorted.length > 0 ? (
          <View style={styles.cardList}>{sorted.map(renderCard)}</View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {t("trainingsCoach.empty")}
          </Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 16,
          },
        ]}
      >
        <Pressable
          testID="button-new-training"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            router.push("/trainings/new");
          }}
          style={({ pressed }) => [
            styles.newBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.newText, { color: colors.primaryForeground }]}>
            {t("trainingsCoach.newButton")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 16 },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardList: { gap: 14 },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catBadgeText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  cardDate: {
    fontSize: 17,
    fontWeight: "600" as const,
    marginTop: 2,
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
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  spots: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  rosterLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rosterText: {
    fontSize: 14,
    fontWeight: "600" as const,
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
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  newBtn: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  newText: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
});
