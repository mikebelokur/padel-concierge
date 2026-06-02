import {
  useListGroupTrainings,
  useListMyTrainingBookings,
  useBookGroupTraining,
  useCancelMyTrainingBooking,
  getUser,
} from "@workspace/api-client-react";
import type {
  GroupTraining,
  TrainingBookingWithTraining,
  User,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  bookingErrorKey,
  CATEGORY_COLORS,
  formatWindowValue,
  isCoachUser,
  isLevelLocked,
  isPastTraining,
  registrationWindow,
  type MyBookingStatus,
} from "@/lib/trainings";

type PlayerTab = "available" | "myBookings" | "history";
const TABS: PlayerTab[] = ["available", "myBookings", "history"];

const GOLD = "#D4AF37";

function CategoryBadge({ cat }: { cat: string }) {
  const color = CATEGORY_COLORS[cat] ?? GOLD;
  return (
    <View
      style={[
        styles.catBadge,
        { borderColor: `${color}55`, backgroundColor: `${color}1f` },
      ]}
    >
      <Text style={[styles.catBadgeText, { color }]}>{cat}</Text>
    </View>
  );
}

function ProgressBar({ booked, max }: { booked: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((booked / max) * 100)) : 0;
  const full = booked >= max;
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${pct}%`, backgroundColor: full ? GOLD : "#4ade80" },
        ]}
      />
    </View>
  );
}

export default function TrainingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

  const lang = user?.language ?? "ru";
  const isCoach = isCoachUser(user);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const [tab, setTab] = useState<PlayerTab>("available");
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    data: trainings,
    isLoading: trainingsLoading,
    refetch: refetchTrainings,
  } = useListGroupTrainings();
  const {
    data: myBookings,
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useListMyTrainingBookings();

  const book = useBookGroupTraining();
  const cancel = useCancelMyTrainingBooking();

  const coachIds = useMemo(() => {
    const ids = new Set<number>();
    (trainings ?? []).forEach((tr) => ids.add(tr.coachId));
    (myBookings ?? []).forEach((b) => {
      if (b.training) ids.add(b.training.coachId);
    });
    return Array.from(ids).sort((a, b) => a - b);
  }, [trainings, myBookings]);

  const { data: coaches } = useQuery({
    queryKey: ["training-coaches", coachIds.join(",")],
    enabled: coachIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        coachIds.map((id) => getUser(id).catch(() => null)),
      );
      return results.filter((c): c is User => !!c);
    },
  });

  const coachMap = useMemo(() => {
    const m = new Map<number, User>();
    (coaches ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [coaches]);

  const coachNameFor = (coachId: number): string =>
    coachMap.get(coachId)?.name ?? `#${coachId}`;

  const refreshAll = () => {
    refetchTrainings();
    refetchBookings();
  };

  const bookingByTrainingId = useMemo(() => {
    const map = new Map<string, TrainingBookingWithTraining>();
    for (const b of myBookings ?? []) {
      map.set(b.trainingId, b);
    }
    return map;
  }, [myBookings]);

  const myStatusFor = (id: string): MyBookingStatus => {
    const b = bookingByTrainingId.get(id);
    if (!b) return null;
    if (
      b.status === "booked" ||
      b.status === "cancelled" ||
      b.status === "attended" ||
      b.status === "no_show"
    ) {
      return b.status;
    }
    return null;
  };

  const availableTrainings = useMemo(() => {
    return (trainings ?? [])
      .filter((tr) => !isPastTraining(tr, myStatusFor(tr.id)))
      .sort(
        (a, b) =>
          new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainings, bookingByTrainingId]);

  const upcomingBookings = useMemo(() => {
    return (myBookings ?? [])
      .filter(
        (b) =>
          b.status === "booked" && !isPastTraining(b.training, "booked"),
      )
      .sort(
        (a, b) =>
          new Date(a.training.dateTime).getTime() -
          new Date(b.training.dateTime).getTime(),
      );
  }, [myBookings]);

  const pastBookings = useMemo(() => {
    return (myBookings ?? [])
      .filter(
        (b) =>
          b.status !== "cancelled" &&
          isPastTraining(b.training, myStatusFor(b.trainingId)),
      )
      .sort(
        (a, b) =>
          new Date(b.training.dateTime).getTime() -
          new Date(a.training.dateTime).getTime(),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myBookings, bookingByTrainingId]);

  async function handleBook(training: GroupTraining) {
    if (busyId) return;
    Alert.alert(
      t("trainings.confirmBookTitle"),
      t("trainings.confirmBookBody", {
        category: training.category,
        price: Math.round(Number(training.priceAed)),
      }),
      [
        { text: t("trainings.keep"), style: "cancel" },
        {
          text: t("trainings.confirmBook"),
          onPress: async () => {
            setBusyId(training.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            try {
              await book.mutateAsync({ id: training.id });
              refreshAll();
              Alert.alert(t("trainings.bookSuccess"));
            } catch (err) {
              Alert.alert(t(bookingErrorKey(err)));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  async function handleCancel(training: GroupTraining) {
    if (busyId) return;
    Alert.alert(
      t("trainings.confirmCancelTitle"),
      t("trainings.confirmCancelBody"),
      [
        { text: t("trainings.keep"), style: "cancel" },
        {
          text: t("trainings.confirmCancelYes"),
          style: "destructive",
          onPress: async () => {
            setBusyId(training.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            try {
              await cancel.mutateAsync({ id: training.id });
              refreshAll();
              Alert.alert(t("trainings.cancelSuccess"));
            } catch {
              Alert.alert(t("trainings.errors.generic"));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  function renderCard(training: GroupTraining) {
    const myStatus = myStatusFor(training.id);
    const isBooked = myStatus === "booked";
    const isPast = isPastTraining(training, myStatus);
    const locked = isLevelLocked(training, user?.level ?? null, myStatus);
    const isFull =
      training.bookedCount >= training.maxParticipants && !isBooked;
    const win = registrationWindow(training);
    const notOpenYet = win.kind === "scheduled";
    const regClosed = win.kind === "closed";
    const busy = busyId === training.id;
    const price = Math.round(Number(training.priceAed));

    let footer: React.ReactNode = null;
    if (isBooked && !isPast) {
      footer = (
        <Pressable
          testID={`button-cancel-${training.id}`}
          onPress={() => handleCancel(training)}
          disabled={busy}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: "rgba(245,69,69,0.12)",
              borderColor: "rgba(245,69,69,0.35)",
              borderWidth: 1,
              opacity: busy ? 0.6 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.destructive }]}>
            {busy ? t("trainings.cancelling") : t("trainings.cancelBooking")}
          </Text>
        </Pressable>
      );
    } else if (isBooked && isPast) {
      footer = (
        <View style={[styles.statusPill, { backgroundColor: `${GOLD}1f` }]}>
          <Text style={[styles.statusPillText, { color: GOLD }]}>
            {t(`trainings.status.${myStatus}`)}
          </Text>
        </View>
      );
    } else if (locked) {
      footer = (
        <View style={styles.lockedRow}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
            {t("trainings.lockedHint", { category: training.category })}
          </Text>
        </View>
      );
    } else if (notOpenYet) {
      footer = (
        <Text style={[styles.windowText, { color: colors.mutedForeground }]}>
          {t("trainings.window.opensIn", {
            value: formatWindowValue(
              win.kind === "scheduled" ? win.opensInHours : 0,
              t,
            ),
          })}
        </Text>
      );
    } else if (regClosed) {
      footer = (
        <Text style={[styles.windowText, { color: colors.mutedForeground }]}>
          {t("trainings.window.closed")}
        </Text>
      );
    } else if (isFull) {
      footer = (
        <View style={[styles.statusPill, { backgroundColor: `${GOLD}1f` }]}>
          <Text style={[styles.statusPillText, { color: GOLD }]}>
            {t("trainings.full")}
          </Text>
        </View>
      );
    } else {
      const closingSoon = win.kind === "closing_soon";
      footer = (
        <View style={{ gap: 8 }}>
          {closingSoon ? (
            <Text
              style={[styles.windowText, { color: colors.mutedForeground }]}
            >
              {t("trainings.window.closesIn", {
                value: formatWindowValue(win.closesInHours, t),
              })}
            </Text>
          ) : null}
          <Pressable
            testID={`button-book-${training.id}`}
            onPress={() => handleBook(training)}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.primary,
                opacity: busy ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[styles.actionText, { color: colors.primaryForeground }]}
            >
              {busy ? t("trainings.booking") : t("trainings.book")}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View
        key={training.id}
        testID={`training-${training.id}`}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: isPast && !isBooked ? 0.7 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <CategoryBadge cat={training.category} />
          <View style={styles.priceWrap}>
            <Text style={[styles.priceValue, { color: colors.foreground }]}>
              {price}
            </Text>
            <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}>
              AED
            </Text>
          </View>
        </View>

        <Text style={[styles.cardDate, { color: colors.foreground }]}>
          {formatMatchDateTime(training.dateTime, null, lang, "long")}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {t("trainings.duration", { minutes: training.durationMinutes })}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text
            style={[styles.metaText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {training.courtName}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="user" size={13} color={colors.mutedForeground} />
          <Text
            style={[styles.metaText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {t("trainings.coach")}: {coachNameFor(training.coachId)}
          </Text>
        </View>

        {training.descriptionRu || training.descriptionEn ? (
          <Text
            style={[styles.cardDesc, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {lang === "en"
              ? (training.descriptionEn ?? training.descriptionRu)
              : (training.descriptionRu ?? training.descriptionEn)}
          </Text>
        ) : null}

        <View style={{ gap: 6, marginTop: 4 }}>
          <View style={styles.spotsRow}>
            <Text
              style={[styles.spotsText, { color: colors.mutedForeground }]}
            >
              {training.bookedCount}/{training.maxParticipants}
            </Text>
            <Text
              style={[
                styles.spotsText,
                {
                  color: isFull
                    ? GOLD
                    : training.maxParticipants - training.bookedCount === 1
                      ? GOLD
                      : "#4ade80",
                },
              ]}
            >
              {isFull
                ? t("trainings.full")
                : training.maxParticipants - training.bookedCount === 1
                  ? t("trainings.lastSpot")
                  : t("trainings.spotsLeft", {
                      count: training.maxParticipants - training.bookedCount,
                    })}
            </Text>
          </View>
          <ProgressBar
            booked={training.bookedCount}
            max={training.maxParticipants}
          />
        </View>

        <View style={{ marginTop: 4 }}>{footer}</View>
      </View>
    );
  }

  const isLoading = trainingsLoading || bookingsLoading;

  const list =
    tab === "available"
      ? availableTrainings.map(renderCard)
      : tab === "myBookings"
        ? upcomingBookings.map((b) => renderCard(b.training))
        : pastBookings.map((b) => renderCard(b.training));

  const emptyKey =
    tab === "available"
      ? "trainings.empty.available"
      : tab === "myBookings"
        ? "trainings.empty.myBookings"
        : "trainings.empty.history";

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
          refreshing={isLoading}
          onRefresh={refreshAll}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            {t("trainings.title")}
          </Text>
          <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
            {t("trainings.subtitle")}
          </Text>
        </View>
        {isCoach ? (
          <Pressable
            testID="button-manage-trainings"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              router.push("/trainings/coach");
            }}
            style={({ pressed }) => [
              styles.manageBtn,
              {
                borderColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="settings" size={15} color={colors.primary} />
            <Text style={[styles.manageText, { color: colors.primary }]}>
              {t("trainings.manage")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        {TABS.map((tb) => {
          const active = tab === tb;
          return (
            <Pressable
              key={tb}
              testID={`tab-${tb}`}
              onPress={() => setTab(tb)}
              style={[
                styles.tabItem,
                {
                  backgroundColor: active ? `${colors.primary}26` : "transparent",
                  borderRadius: colors.radius - 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary : colors.mutedForeground },
                ]}
              >
                {t(`trainings.tabs.${tb}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading && list.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.length > 0 ? (
        <View style={styles.cardList}>{list}</View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t(emptyKey)}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 18 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
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
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 2,
  },
  manageText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  tabBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600" as const,
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
  priceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  priceUnit: {
    fontSize: 11,
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
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  spotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spotsText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  actionBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 6,
  },
  lockedText: {
    fontSize: 13,
    flex: 1,
  },
  windowText: {
    fontSize: 13,
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
