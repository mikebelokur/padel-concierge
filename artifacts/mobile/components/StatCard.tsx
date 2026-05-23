import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
  small?: boolean;
}

export function StatCard({ label, value, accent = false, small = false }: StatCardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: accent ? `${colors.primary}44` : colors.border,
          borderRadius: colors.radius,
          flex: 1,
          padding: small ? 12 : 16,
        },
      ]}
    >
      <Text
        style={[
          styles.value,
          {
            color: accent ? colors.primary : colors.foreground,
            fontSize: small ? 22 : 28,
          },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground, fontSize: small ? 11 : 12 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 4,
  },
  value: {
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  label: {
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
