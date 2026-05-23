import { useLogin } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate: doLogin, isPending } = useLogin({
    mutation: {
      onSuccess: async (data) => {
        await auth.login(data.token, data.user);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        router.replace("/(tabs)");
      },
      onError: () => {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
        Alert.alert("Login failed", "Check your email and password.");
      },
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Enter your email and password.");
      return;
    }
    doLogin({ data: { email: email.trim(), password } });
  };

  const topPad =
    Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <View
            style={[
              styles.logoCircle,
              { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Text style={[styles.logoIcon, { color: colors.primary }]}>PC</Text>
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>
            Padel Concierge
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Premium matchmaking · Dubai
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldWrapper}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              EMAIL
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholderTextColor={colors.mutedForeground}
              placeholder="player@padelconcierge.com"
              testID="email-input"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              PASSWORD
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholderTextColor={colors.mutedForeground}
              placeholder="••••••••"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              testID="password-input"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: isPending ? 0.7 : pressed ? 0.88 : 1,
                transform: pressed && !isPending ? [{ scale: 0.98 }] : [],
              },
            ]}
            onPress={handleLogin}
            disabled={isPending}
            testID="login-button"
          >
            {isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.loginLabel, { color: colors.primaryForeground }]}>
                Sign In
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Test: player@padelconcierge.com / player123
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 0,
  },
  logoArea: {
    alignItems: "center",
    gap: 12,
    marginBottom: 52,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    fontSize: 22,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  fieldWrapper: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  loginButton: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginLabel: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
  },
});
