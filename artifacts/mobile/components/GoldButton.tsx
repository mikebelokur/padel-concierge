import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
  testID?: string;
}

export function GoldButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  testID,
}: GoldButtonProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: colors.radius,
          backgroundColor:
            variant === "primary"
              ? colors.primary
              : "transparent",
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor:
            variant === "outline" ? colors.primary : "transparent",
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: pressed && !isDisabled ? [{ scale: 0.98 }] : [],
        },
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.primaryForeground : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color:
                variant === "primary"
                  ? colors.primaryForeground
                  : variant === "ghost"
                  ? colors.mutedForeground
                  : colors.primary,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
});
