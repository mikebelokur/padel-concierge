import { useGetMatch } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

type FeatherName = ComponentProps<typeof Feather>["name"];

const FORMAT_INFO: Record<string, string> = {
  Classic: "Best of 3 sets",
  Simplified: "2 sets",
  Rotation: "Partner swap every 15–20 min",
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface InfoRowProps {
  icon: FeatherName;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}

function InfoRow({ icon, label, value, colors }: InfoRowProps) {
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <Feather name={icon} size={15} color={colors.mutedForeground} />
      <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[rowStyles.value, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    width: 80,
  },
  value: {
    fontSize: 14,
    flex: 1,
    textAlign: "right",
    fontWeight: "500" as const,
  },
});

export default function MatchDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: match, isLoading, error } = useGetMatch(Number(id));

  const isAlreadyBooked = match?.players.some((p) => p.userId === user?.id);
  const isFull = match?.players.length !== undefined && match.players.length >= 4;

  const handleBook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push(`/book/${id}`);
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !match) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <Feather name="alert-circle" size={32} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          Match not found
        </Text>
        <Pressable
          style={[
            styles.retryBtn,
            { borderColor: colors.border, borderRadius: colors.radius },
          ]}
          onPress={() => router.back()}
        >
          <Text style={[styles.retryText, { color: colors.foreground }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const formatDesc = FORMAT_INFO[match.format] ?? match.format;
  const levelValue =
    match.levelMin && match.levelMax && match.levelMin !== match.levelMax
      ? `${match.levelMin} – ${match.levelMax}`
      : match.levelMin ?? "Open";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.heroHeader}>
            <Text
              style={[styles.clubName, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {match.clubName}
            </Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    match.status === "open"
                      ? `${colors.accent}22`
                      : colors.muted,
                  borderRadius: 14,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      match.status === "open"
                        ? colors.accent
                        : colors.mutedForeground,
                  },
                ]}
              >
                {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <Feather name="calendar" size={14} color={colors.mutedForeground} />
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatDate(match.date)} · {match.time}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <InfoRow
            icon="grid"
            label="Format"
            value={`${match.format} — ${formatDesc}`}
            colors={colors}
          />
          <InfoRow icon="bar-chart-2" label="Level" value={levelValue} colors={colors} />
          <InfoRow icon="map-pin" label="Venue" value={match.clubName} colors={colors} />
          <InfoRow
            icon="tag"
            label="Price"
            value={match.price > 0 ? `${match.price} AED` : "Free"}
            colors={colors}
          />
        </View>

        <View style={styles.playersSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Players ({match.players.length}/4)
          </Text>
          <View style={styles.playersGrid}>
            {match.players.map((p) => (
              <View key={p.userId} style={styles.playerItem}>
                <PlayerAvatar name={p.name} level={p.level} size={52} />
                <Text
                  style={[styles.playerName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {p.name.split(" ")[0]}
                </Text>
                <View
                  style={[
                    styles.confirmedDot,
                    {
                      backgroundColor: p.confirmed
                        ? colors.accent
                        : colors.muted,
                    },
                  ]}
                />
              </View>
            ))}
            {Array.from({
              length: Math.max(0, 4 - match.players.length),
            }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.playerItem}>
                <View
                  style={[
                    styles.emptySlot,
                    {
                      borderColor: colors.border,
                      borderRadius: 26,
                      width: 52,
                      height: 52,
                    },
                  ]}
                >
                  <Feather name="plus" size={20} color={colors.mutedForeground} />
                </View>
                <Text
                  style={[styles.playerName, { color: colors.mutedForeground }]}
                >
                  Open
                </Text>
              </View>
            ))}
          </View>
        </View>

        {(match.levelMin === "C+" ||
          match.levelMin === "A" ||
          match.levelMin === "B") ? (
          <View
            style={[
              styles.warmupCard,
              {
                backgroundColor: `${colors.accent}0d`,
                borderColor: `${colors.accent}33`,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="clock" size={16} color={colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.warmupTitle, { color: colors.accent }]}>
                Warm-up Protocol Required
              </Text>
              <Text style={[styles.warmupText, { color: colors.mutedForeground }]}>
                10-minute structured warm-up for {match.levelMin}+ players
              </Text>
            </View>
          </View>
        ) : null}
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
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
            Court fee
          </Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>
            {match.price > 0 ? `${match.price} AED` : "Free"}
          </Text>
        </View>

        {isAlreadyBooked ? (
          <View
            style={[
              styles.bookedBadge,
              {
                backgroundColor: `${colors.accent}18`,
                borderColor: `${colors.accent}44`,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="check-circle" size={18} color={colors.accent} />
            <Text style={[styles.bookedText, { color: colors.accent }]}>
              You're booked
            </Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.bookBtn,
              {
                backgroundColor:
                  isFull || match.status !== "open"
                    ? colors.muted
                    : colors.primary,
                borderRadius: colors.radius,
                opacity:
                  isFull || match.status !== "open"
                    ? 0.6
                    : pressed
                    ? 0.88
                    : 1,
                transform: pressed && !isFull ? [{ scale: 0.98 }] : [],
              },
            ]}
            onPress={handleBook}
            disabled={isFull || match.status !== "open"}
            testID="book-match-btn"
          >
            <Text
              style={[
                styles.bookBtnText,
                {
                  color:
                    isFull || match.status !== "open"
                      ? colors.mutedForeground
                      : colors.primaryForeground,
                },
              ]}
            >
              {isFull
                ? "Match Full"
                : match.status !== "open"
                ? "Not Available"
                : "Book This Match"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  heroCard: {
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  clubName: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  section: {
    gap: 0,
  },
  playersSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  playersGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  playerItem: {
    alignItems: "center",
    gap: 8,
  },
  playerName: {
    fontSize: 12,
    fontWeight: "500" as const,
    maxWidth: 64,
    textAlign: "center",
  },
  confirmedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptySlot: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  warmupCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderWidth: 1,
  },
  warmupTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  warmupText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  bookBtn: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  bookedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderWidth: 1,
  },
  bookedText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  errorText: {
    fontSize: 16,
  },
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
