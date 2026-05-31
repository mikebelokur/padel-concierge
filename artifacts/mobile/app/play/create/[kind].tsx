import {
  useListClubs,
  useCreatePlayMatch,
} from "@workspace/api-client-react";
import type { CreatePlayMatchBody } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { useTranslation } from "@/i18n";

type MatchKind = "unranked" | "competitive" | "personal";
type MatchVisibility = "private" | "open";
type MatchGoal = "competitive" | "social" | "learning" | "energy";

const VALID_KINDS: MatchKind[] = ["unranked", "competitive", "personal"];
const PERSONAL_GOALS: MatchGoal[] = ["competitive", "social", "learning", "energy"];
const MIN_SLOT = 60;
const DEFAULT_SLOT = 90;
const SLOT_OPTIONS = [60, 90, 120];

const KIND_ICON: Record<MatchKind, string> = {
  unranked: "🎾",
  competitive: "🏆",
  personal: "🎯",
};

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PlayCreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();

  const kind = (kindParam ?? "unranked") as MatchKind;
  const validKind = VALID_KINDS.includes(kind);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: clubs } = useListClubs();
  const create = useCreatePlayMatch();

  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState("");
  const [clubName, setClubName] = useState("");
  const [slotMinutes, setSlotMinutes] = useState(DEFAULT_SLOT);
  const [visibility, setVisibility] = useState<MatchVisibility>("private");
  const [goal, setGoal] = useState<MatchGoal | null>(null);
  const [styleNote, setStyleNote] = useState("");

  useEffect(() => {
    if (clubs && clubs.length > 0 && !clubName) {
      setClubName(clubs[0].name);
    }
  }, [clubs, clubName]);

  if (!validKind) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: t("playFlow.hubTitle") }} />
        <Text style={{ color: colors.mutedForeground }}>
          {t("playFlow.invalidKind")}
        </Text>
      </View>
    );
  }

  const canSubmit =
    !!date.trim() &&
    !!time.trim() &&
    !!clubName.trim() &&
    slotMinutes >= MIN_SLOT &&
    (kind !== "personal" || goal !== null) &&
    !create.isPending;

  async function submit() {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const body: CreatePlayMatchBody = {
      kind,
      date: date.trim(),
      time: time.trim(),
      clubName: clubName.trim(),
      slotMinutes,
      visibility,
      goal: kind === "personal" ? goal : null,
      styleNote: kind === "personal" ? styleNote.trim() || null : null,
    };
    try {
      const room = await create.mutateAsync({ data: body });
      router.replace(`/play/match/${room.id}`);
    } catch {
      Alert.alert(t("playFlow.error"), t("playFlow.error"));
    }
  }

  const labelStyle = [styles.label, { color: colors.mutedForeground }];
  const inputStyle = [
    styles.input,
    {
      borderColor: colors.border,
      borderRadius: colors.radius,
      color: colors.foreground,
      backgroundColor: colors.card,
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t(`playFlow.kind.${kind}.title`) }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroRow}>
          <Text style={styles.heroIcon}>{KIND_ICON[kind]}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              {t(`playFlow.kind.${kind}.title`)}
            </Text>
            <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
              {t(`playFlow.kind.${kind}.desc`)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.formatNote,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.formatText, { color: colors.mutedForeground }]}>
            🎾 {t("playFlow.formatFixed")}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("playFlow.date")}</Text>
          <TextInput
            testID="input-date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("playFlow.time")}</Text>
          <TextInput
            testID="input-time"
            value={time}
            onChangeText={setTime}
            placeholder={t("playFlow.timePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("playFlow.club")}</Text>
          {clubs && clubs.length > 0 ? (
            <View style={styles.chipWrap}>
              {clubs.map((c) => {
                const active = clubName === c.name;
                return (
                  <Pressable
                    key={c.id}
                    testID={`club-${c.id}`}
                    onPress={() => setClubName(c.name)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? `${colors.primary}26` : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              testID="input-club"
              value={clubName}
              onChangeText={setClubName}
              placeholder={t("playFlow.clubPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              style={inputStyle}
            />
          )}
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("playFlow.slot")}</Text>
          <View style={styles.chipWrap}>
            {SLOT_OPTIONS.map((m) => {
              const active = slotMinutes === m;
              return (
                <Pressable
                  key={m}
                  testID={`slot-${m}`}
                  onPress={() => setSlotMinutes(m)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? `${colors.primary}26` : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {Math.floor(m / 60)}
                    {t("playFlow.hourShort")}
                    {m % 60 ? ` ${m % 60}${t("playFlow.minShort")}` : ""}
                    {m === DEFAULT_SLOT
                      ? `  ★ ${t("playFlow.slotRecommended")}`
                      : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t("playFlow.slotHint")}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("playFlow.visibility")}</Text>
          <View style={styles.visRow}>
            {(["private", "open"] as MatchVisibility[]).map((v) => {
              const active = visibility === v;
              return (
                <Pressable
                  key={v}
                  testID={`visibility-${v}`}
                  onPress={() => setVisibility(v)}
                  style={[
                    styles.visCard,
                    {
                      backgroundColor: active ? `${colors.primary}1f` : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={[styles.visTitle, { color: colors.foreground }]}>
                    {t(`playFlow.visibility_${v}`)}
                  </Text>
                  <Text style={[styles.visDesc, { color: colors.mutedForeground }]}>
                    {t(`playFlow.visibility_${v}_desc`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {kind === "personal" ? (
          <>
            <View style={styles.field}>
              <Text style={labelStyle}>{t("playFlow.goal")}</Text>
              <View style={styles.chipWrap}>
                {PERSONAL_GOALS.map((g) => {
                  const active = goal === g;
                  return (
                    <Pressable
                      key={g}
                      testID={`goal-${g}`}
                      onPress={() => setGoal(g)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? `${colors.primary}26` : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? colors.primary : colors.mutedForeground },
                        ]}
                      >
                        {t(`playFlow.goalOptions.${g}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={labelStyle}>{t("playFlow.style")}</Text>
              <TextInput
                testID="input-style"
                value={styleNote}
                onChangeText={setStyleNote}
                placeholder={t("playFlow.stylePlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[
                  inputStyle,
                  { height: 88, paddingTop: 12, textAlignVertical: "top" },
                ]}
              />
            </View>
          </>
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
        <Pressable
          testID="button-create-match"
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: canSubmit ? colors.primary : colors.muted,
              borderRadius: colors.radius,
              opacity: pressed && canSubmit ? 0.88 : 1,
            },
          ]}
          onPress={submit}
          disabled={!canSubmit}
        >
          <Text
            style={[
              styles.submitText,
              { color: canSubmit ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {create.isPending ? t("playFlow.creating") : t("playFlow.createButton")}
          </Text>
          {!create.isPending ? (
            <Feather
              name="arrow-right"
              size={18}
              color={canSubmit ? colors.primaryForeground : colors.mutedForeground}
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 20 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: { fontSize: 34 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  },
  heroDesc: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  formatNote: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formatText: { fontSize: 13, lineHeight: 18 },
  field: { gap: 10 },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  hint: { fontSize: 12 },
  visRow: {
    flexDirection: "row",
    gap: 10,
  },
  visCard: {
    flex: 1,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  visTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  visDesc: {
    fontSize: 12,
    lineHeight: 16,
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
  submitBtn: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
});
