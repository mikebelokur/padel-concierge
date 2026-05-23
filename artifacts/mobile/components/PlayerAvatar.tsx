import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PlayerAvatarProps {
  name: string;
  level?: string;
  size?: number;
  showLevel?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f97316",
  "C+": "#D4AF37",
  C: "#22c55e",
  D: "#3b82f6",
};

export function PlayerAvatar({
  name,
  level,
  size = 48,
  showLevel = true,
}: PlayerAvatarProps) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const levelColor = level ? (LEVEL_COLORS[level] ?? colors.mutedForeground) : colors.mutedForeground;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${levelColor}22`,
            borderColor: levelColor,
            borderWidth: 1.5,
          },
        ]}
      >
        <Text
          style={[
            styles.initials,
            {
              fontSize: size * 0.33,
              color: levelColor,
            },
          ]}
        >
          {initials || "?"}
        </Text>
      </View>
      {showLevel && level ? (
        <View
          style={[
            styles.levelBadge,
            { backgroundColor: levelColor, borderRadius: 4 },
          ]}
        >
          <Text style={styles.levelText}>{level}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700" as const,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#000000",
  },
});
