import { useGetPlayerStats, useUpdateUser } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useTranslation } from "@/i18n";
import { StatCard } from "@/components/StatCard";

type FeatherName = ComponentProps<typeof Feather>["name"];

const LANGUAGE_OPTIONS: { code: "en" | "ru" | "ar"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "عربي" },
];

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Русский",
  ar: "عربي",
};

const ARCHETYPE_ICONS: Record<string, FeatherName> = {
  "pro-ambitious": "zap",
  "competitive-improver": "trending-up",
  "balanced-competitor": "activity",
  "social-enjoyer": "users",
  "casual-recreational": "sun",
};

const LEVEL_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f97316",
  "C+": "#D4AF37",
  C: "#22c55e",
  D: "#3b82f6",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { t } = useTranslation();
  const updateUserMutation = useUpdateUser();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: stats, isLoading: statsLoading } = useGetPlayerStats(
    user?.id ?? 0,
    { query: { enabled: !!user?.id } as never }
  );

  const winRate =
    user && user.matchesPlayed > 0
      ? Math.round((user.wins / user.matchesPlayed) * 100)
      : 0;

  const archetypeKey = (user as Record<string, unknown> | null)?.[
    "archetype"
  ] as string | undefined;
  const archetypeIcon = archetypeKey ? ARCHETYPE_ICONS[archetypeKey] : null;
  const archetypeLabel = archetypeKey
    ? t(`profile.archetypes.${archetypeKey}`)
    : null;
  const levelColor = LEVEL_COLORS[user?.level ?? "C"] ?? colors.mutedForeground;

  const handleLanguageChange = (lang: "en" | "ru" | "ar") => {
    if (!user || user.language === lang) return;
    const prev = user;
    const next = { ...user, language: lang };
    updateUser(next);
    updateUserMutation.mutate(
      { id: user.id, data: { language: lang } },
      {
        onError: () => {
          updateUser(prev);
          Alert.alert(
            t("profile.languageUpdateFailedTitle"),
            t("profile.languageUpdateFailedBody"),
          );
        },
      },
    );
  };

  const handleLanguagePress = () => {
    setLanguagePickerOpen(true);
  };

  const handleLanguageSelect = (lang: "en" | "ru" | "ar") => {
    setLanguagePickerOpen(false);
    handleLanguageChange(lang);
  };

  const handleLogout = () => {
    Alert.alert(t("profile.signOut"), t("profile.signOutPrompt"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOut"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const detailItems: {
    icon: FeatherName;
    label: string;
    value?: string | null;
    onPress?: () => void;
    testID?: string;
  }[] = [
    { icon: "target", label: t("profile.rows.goal"), value: user?.goal },
    { icon: "zap", label: t("profile.rows.intensity"), value: user?.intensity },
    { icon: "map-pin", label: t("profile.rows.location"), value: user?.locationName },
    {
      icon: "globe",
      label: t("profile.rows.language"),
      value: user?.language
        ? LANGUAGE_LABELS[user.language] ?? user.language
        : LANGUAGE_LABELS.en,
      onPress: handleLanguagePress,
      testID: "language-row",
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: levelColor,
              backgroundColor: `${levelColor}18`,
            },
          ]}
        >
          <Text style={[styles.avatarInitials, { color: levelColor }]}>
            {user?.name
              ?.split(" ")
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("") ?? "P"}
          </Text>
        </View>
        <Text style={[styles.playerName, { color: colors.foreground }]}>
          {user?.name ?? t("common.player")}
        </Text>
        <Text style={[styles.playerEmail, { color: colors.mutedForeground }]}>
          {user?.email ?? ""}
        </Text>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: `${levelColor}22`,
                borderColor: `${levelColor}55`,
                borderRadius: 6,
              },
            ]}
          >
            <Text style={[styles.levelText, { color: levelColor }]}>
              {t("common.level")} {user?.level ?? "—"}
            </Text>
          </View>

          {user?.verified ? (
            <View
              style={[
                styles.verifiedBadge,
                {
                  backgroundColor: `${colors.accent}18`,
                  borderColor: `${colors.accent}44`,
                  borderRadius: 6,
                },
              ]}
            >
              <Feather name="check-circle" size={12} color={colors.accent} />
              <Text style={[styles.verifiedText, { color: colors.accent }]}>
                {t("common.verified")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {archetypeLabel && archetypeIcon ? (
        <View
          style={[
            styles.archetypeCard,
            {
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}33`,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name={archetypeIcon} size={20} color={colors.primary} />
          <View style={styles.archetypeInfo}>
            <Text
              style={[styles.archetypeLabel, { color: colors.mutedForeground }]}
            >
              {t("profile.archetypeLabel")}
            </Text>
            <Text style={[styles.archetypeValue, { color: colors.primary }]}>
              {archetypeLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {statsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("profile.performance")}
          </Text>
          <View style={styles.statsRow}>
            <StatCard
              label={t("profile.stats.matches")}
              value={stats?.matchesPlayed ?? user?.matchesPlayed ?? 0}
              accent
              small
            />
            <StatCard label={t("profile.stats.wins")} value={user?.wins ?? 0} small />
          </View>
          <View style={styles.statsRow}>
            <StatCard label={t("profile.stats.winRate")} value={`${winRate}%`} small />
            <StatCard
              label={t("profile.stats.reliability")}
              value={
                user?.verified
                  ? t("profile.stats.reliabilityHigh")
                  : (user?.matchesPlayed ?? 0) > 0
                  ? t("profile.stats.reliabilityGood")
                  : "—"
              }
              small
            />
          </View>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t("profile.details")}
        </Text>
        {detailItems
          .filter((item) => item.value || item.onPress)
          .map((item) => {
            const content = (
              <>
                <Feather name={item.icon} size={16} color={colors.mutedForeground} />
                <Text
                  style={[styles.infoLabel, { color: colors.mutedForeground }]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[styles.infoValue, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.value}
                </Text>
                {item.onPress ? (
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={colors.mutedForeground}
                  />
                ) : null}
              </>
            );
            if (item.onPress) {
              return (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  testID={item.testID}
                  style={({ pressed }) => [
                    styles.infoRow,
                    { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  {content}
                </Pressable>
              );
            }
            return (
              <View
                key={item.label}
                style={[styles.infoRow, { borderBottomColor: colors.border }]}
              >
                {content}
              </View>
            );
          })}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.logoutBtn,
          {
            backgroundColor: `${colors.destructive}15`,
            borderColor: `${colors.destructive}44`,
            borderRadius: colors.radius,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={handleLogout}
        testID="logout-button"
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>
          {t("profile.signOut")}
        </Text>
      </Pressable>

      <Modal
        visible={languagePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguagePickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setLanguagePickerOpen(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t("profile.languageTitle")}
            </Text>
            {LANGUAGE_OPTIONS.map((opt) => {
              const selected = (user?.language ?? "en") === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => handleLanguageSelect(opt.code)}
                  testID={`language-option-${opt.code}`}
                  style={({ pressed }) => [
                    styles.modalOption,
                    {
                      borderBottomColor: colors.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.modalOptionLabel, { color: colors.foreground }]}
                  >
                    {opt.label}
                  </Text>
                  {selected ? (
                    <Feather name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setLanguagePickerOpen(false)}
              style={({ pressed }) => [
                styles.modalCancel,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[styles.modalCancelText, { color: colors.mutedForeground }]}
              >
                {t("common.cancel")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  profileHeader: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 8,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  playerName: {
    fontSize: 24,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  playerEmail: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 4,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  levelText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  archetypeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  archetypeInfo: {
    gap: 3,
  },
  archetypeLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  archetypeValue: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  statsSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  infoSection: {
    gap: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: "right",
    fontWeight: "500" as const,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderWidth: 1,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalOptionLabel: {
    fontSize: 15,
    fontWeight: "500" as const,
  },
  modalCancel: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
