import type { Match } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { formatMatchDateTime } from "@/lib/datetime";

interface MatchCardProps {
  match: Match;
  tag?: string;
  tagColor?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f97316",
  "C+": "#D4AF37",
  C: "#22c55e",
  D: "#3b82f6",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function MatchCard({ match, tag, tagColor }: MatchCardProps) {
  const colors = useColors();
  const { user } = useAuth();
  const locale = user?.language ?? "en";

  const levelColor =
    LEVEL_COLORS[match.levelMin ?? "C"] ?? colors.mutedForeground;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={() => router.push(`/match/${match.id}`)}
      testID={`match-card-${match.id}`}
    >
      {tag ? (
        <View
          style={[
            styles.tag,
            {
              backgroundColor: tagColor
                ? `${tagColor}22`
                : `${colors.primary}22`,
              borderRadius: 4,
            },
          ]}
        >
          <Text
            style={[
              styles.tagText,
              { color: tagColor ?? colors.primary },
            ]}
          >
            {tag}
          </Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.venueRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text
            style={[styles.venue, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {match.clubName}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                match.status === "open"
                  ? `${colors.accent}22`
                  : `${colors.muted}`,
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
            {STATUS_LABELS[match.status] ?? match.status}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
            {formatMatchDateTime(match.date, match.time, locale)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Feather name="grid" size={12} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
            {match.format}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.levelRow}>
          <View
            style={[
              styles.levelDot,
              { backgroundColor: levelColor },
            ]}
          />
          <Text style={[styles.levelText, { color: colors.foreground }]}>
            {match.levelMin ?? "C"}
            {match.levelMax && match.levelMax !== match.levelMin
              ? `–${match.levelMax}`
              : ""}
          </Text>
        </View>

        <View style={styles.playersRow}>
          {match.players.slice(0, 3).map((p, i) => (
            <View
              key={p.userId}
              style={[
                styles.playerBubble,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.background,
                  marginLeft: i > 0 ? -8 : 0,
                },
              ]}
            >
              <Text style={[styles.playerInitial, { color: colors.foreground }]}>
                {p.name[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          ))}
          {match.players.length > 3 ? (
            <View
              style={[
                styles.playerBubble,
                styles.moreBubble,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.background,
                  marginLeft: -8,
                },
              ]}
            >
              <Text style={[styles.playerInitial, { color: colors.mutedForeground }]}>
                +{match.players.length - 3}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.price, { color: colors.primary }]}>
          {match.price > 0 ? `${match.price} AED` : "Free"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: -4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  venue: {
    fontSize: 15,
    fontWeight: "600" as const,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  details: {
    flexDirection: "row",
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  playersRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBubble: {},
  playerInitial: {
    fontSize: 10,
    fontWeight: "700" as const,
  },
  price: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
});
