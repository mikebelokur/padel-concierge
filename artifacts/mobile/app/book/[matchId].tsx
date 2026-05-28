import { useGetMatch, useCreateBooking } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
import { formatMatchDateTime } from "@/lib/datetime";

type BookingStep = "confirm" | "success";

export default function BookMatchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState<BookingStep>("confirm");
  const locale = user?.language ?? "en";

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: match, isLoading: matchLoading } = useGetMatch(
    Number(matchId)
  );

  const { mutate: createBooking, isPending } = useCreateBooking({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        setStep("success");
      },
      onError: (err) => {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
        const msg =
          (err as { message?: string }).message ??
          "Could not complete booking. Please try again.";
        Alert.alert("Booking failed", msg);
      },
    },
  });

  const handleConfirm = () => {
    if (!user?.id || !matchId) return;
    createBooking({ data: { userId: user.id, matchId: Number(matchId) } });
  };

  if (matchLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={32} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          Match not found
        </Text>
      </View>
    );
  }

  if (step === "success") {
    return (
      <View
        style={[
          styles.successScreen,
          { backgroundColor: colors.background },
        ]}
      >
        <View
          style={[
            styles.successIcon,
            {
              backgroundColor: `${colors.primary}18`,
              borderColor: `${colors.primary}44`,
            },
          ]}
        >
          <Feather name="check" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          You're in!
        </Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Booking confirmed for {match.clubName}
        </Text>
        <Text style={[styles.successDate, { color: colors.mutedForeground }]}>
          {formatMatchDateTime(match.date, match.time, locale, "long")}
        </Text>

        <View style={styles.successActions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text
              style={[styles.primaryBtnText, { color: colors.primaryForeground }]}
            >
              Back to Dashboard
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.outlineBtn,
              {
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => router.replace("/(tabs)/matches")}
          >
            <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>
              Find More Matches
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          Confirm Booking
        </Text>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {match.clubName}
          </Text>

          {[
            {
              icon: "calendar" as const,
              label: "Date & Time",
              value: formatMatchDateTime(match.date, match.time, locale, "long"),
            },
            {
              icon: "grid" as const,
              label: "Format",
              value: match.format,
            },
            {
              icon: "bar-chart-2" as const,
              label: "Level",
              value:
                match.levelMin && match.levelMax && match.levelMin !== match.levelMax
                  ? `${match.levelMin} – ${match.levelMax}`
                  : match.levelMin ?? "Open",
            },
            {
              icon: "users" as const,
              label: "Players",
              value: `${match.players.length}/4 confirmed`,
            },
          ].map((row) => (
            <View
              key={row.label}
              style={[
                styles.summaryRow,
                { borderTopColor: colors.border },
              ]}
            >
              <Feather
                name={row.icon}
                size={14}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.summaryLabel, { color: colors.mutedForeground }]}
              >
                {row.label}
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.priceCard,
            {
              backgroundColor: `${colors.primary}0d`,
              borderColor: `${colors.primary}33`,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
            Court fee
          </Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>
            {match.price > 0 ? `${match.price} AED` : "Free"}
          </Text>
          {match.price > 0 ? (
            <Text style={[styles.priceSub, { color: colors.mutedForeground }]}>
              Paid at venue · Test card: 4242 4242 4242 4242
            </Text>
          ) : null}
        </View>

        {(match.levelMin === "C+" ||
          match.levelMin === "A" ||
          match.levelMin === "B") && (
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
                Warm-up Required
              </Text>
              <Text
                style={[styles.warmupText, { color: colors.mutedForeground }]}
              >
                10-minute structured warm-up is mandatory for {match.levelMin}+
                matches
              </Text>
            </View>
          </View>
        )}

        <View
          style={[
            styles.playerCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.playerLabel, { color: colors.mutedForeground }]}>
            Booking as
          </Text>
          <Text style={[styles.playerName, { color: colors.foreground }]}>
            {user?.name ?? "Player"}
          </Text>
          <View style={styles.playerMeta}>
            <View
              style={[
                styles.levelBadge,
                {
                  backgroundColor: `${colors.primary}22`,
                  borderRadius: 4,
                },
              ]}
            >
              <Text style={[styles.levelText, { color: colors.primary }]}>
                Level {user?.level ?? "—"}
              </Text>
            </View>
          </View>
        </View>
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
          style={({ pressed }) => [
            styles.confirmBtn,
            {
              backgroundColor: isPending ? `${colors.primary}88` : colors.primary,
              borderRadius: colors.radius,
              opacity: pressed && !isPending ? 0.88 : 1,
              transform: pressed && !isPending ? [{ scale: 0.98 }] : [],
            },
          ]}
          onPress={handleConfirm}
          disabled={isPending}
          testID="confirm-booking-btn"
        >
          {isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.confirmBtnText,
                { color: colors.primaryForeground },
              ]}
            >
              Confirm Booking
            </Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.cancelBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={() => router.back()}
          disabled={isPending}
        >
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
            Cancel
          </Text>
        </Pressable>
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
    gap: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  summaryCard: {
    borderWidth: 1,
    padding: 20,
    gap: 0,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  summaryLabel: {
    fontSize: 13,
    width: 90,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "500" as const,
    flex: 1,
    textAlign: "right",
  },
  priceCard: {
    borderWidth: 1,
    padding: 20,
    gap: 6,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  priceValue: {
    fontSize: 32,
    fontWeight: "700" as const,
    letterSpacing: -1,
  },
  priceSub: {
    fontSize: 12,
    marginTop: 2,
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
  playerCard: {
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  playerLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  playerName: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  playerMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelText: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  confirmBtn: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  cancelBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
  },
  successScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    letterSpacing: -1,
  },
  successSub: {
    fontSize: 16,
    textAlign: "center",
  },
  successDate: {
    fontSize: 14,
    textAlign: "center",
  },
  successActions: {
    width: "100%",
    gap: 12,
    marginTop: 16,
  },
  primaryBtn: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  outlineBtn: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  errorText: {
    fontSize: 16,
  },
});
