import {
  useCreateGroupTraining,
  getListGroupTrainingsQueryKey,
} from "@workspace/api-client-react";
import type { CreateGroupTrainingBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES, isCoachUser } from "@/lib/trainings";

const GOLD = "#D4AF37";
const DURATIONS = [60, 90, 120];

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function NewTrainingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const create = useCreateGroupTraining();

  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(90);
  const [category, setCategory] = useState<string>("D");
  const [courtName, setCourtName] = useState("");
  const [courtAddress, setCourtAddress] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("4");
  const [price, setPrice] = useState("175");
  const [descEn, setDescEn] = useState("");
  const [descRu, setDescRu] = useState("");

  if (authLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (!isCoachUser(user)) {
    return <Redirect href="/(tabs)/trainings" />;
  }

  const maxNum = Number(maxParticipants);
  const priceNum = Number(price);

  const canSubmit =
    !!date.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) &&
    !!time.trim() &&
    /^\d{2}:\d{2}$/.test(time.trim()) &&
    !!courtName.trim() &&
    Number.isFinite(maxNum) &&
    Number.isInteger(maxNum) &&
    maxNum >= 4 &&
    maxNum <= 8 &&
    Number.isFinite(priceNum) &&
    priceNum >= 0 &&
    !create.isPending;

  async function submit() {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const dateTime = `${date.trim()}T${
      time.trim().length === 5 ? `${time.trim()}:00` : time.trim()
    }+04:00`;
    const body: CreateGroupTrainingBody = {
      dateTime,
      durationMinutes: duration,
      category: category as CreateGroupTrainingBody["category"],
      courtName: courtName.trim(),
      courtAddress: courtAddress.trim() || null,
      maxParticipants: maxNum,
      priceAed: priceNum,
      descriptionEn: descEn.trim() || null,
      descriptionRu: descRu.trim() || null,
    };
    try {
      await create.mutateAsync({ data: body });
      await queryClient.invalidateQueries({
        queryKey: getListGroupTrainingsQueryKey(),
      });
      Alert.alert(t("trainingsCoach.created"));
      router.back();
    } catch {
      Alert.alert(t("trainingsCoach.createError"));
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
      <Stack.Screen options={{ title: t("trainingsCoach.form.title") }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.date")}</Text>
          <TextInput
            testID="input-date"
            value={date}
            onChangeText={setDate}
            placeholder={t("trainingsCoach.form.dateHint")}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.time")}</Text>
          <TextInput
            testID="input-time"
            value={time}
            onChangeText={setTime}
            placeholder={t("trainingsCoach.form.timeHint")}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.duration")}</Text>
          <View style={styles.chipWrap}>
            {DURATIONS.map((m) => {
              const active = duration === m;
              return (
                <Pressable
                  key={m}
                  testID={`duration-${m}`}
                  onPress={() => setDuration(m)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? `${colors.primary}26`
                        : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active ? colors.primary : colors.mutedForeground,
                      },
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.category")}</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  testID={`category-${c}`}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? `${colors.primary}26`
                        : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active ? colors.primary : colors.mutedForeground,
                      },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.court")}</Text>
          <TextInput
            testID="input-court"
            value={courtName}
            onChangeText={setCourtName}
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>
            {t("trainingsCoach.form.courtAddress")}
          </Text>
          <TextInput
            testID="input-court-address"
            value={courtAddress}
            onChangeText={setCourtAddress}
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={labelStyle}>
              {t("trainingsCoach.form.maxParticipants")}
            </Text>
            <TextInput
              testID="input-max"
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="number-pad"
              placeholderTextColor={colors.mutedForeground}
              style={[
                inputStyle,
                maxParticipants.trim().length > 0 &&
                (!Number.isInteger(maxNum) || maxNum < 4 || maxNum > 8)
                  ? { borderColor: colors.destructive }
                  : null,
              ]}
            />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {t("trainingsCoach.form.maxParticipantsHint")}
            </Text>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={labelStyle}>{t("trainingsCoach.form.price")}</Text>
            <TextInput
              testID="input-price"
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              placeholderTextColor={colors.mutedForeground}
              style={inputStyle}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.descRu")}</Text>
          <TextInput
            testID="input-desc-ru"
            value={descRu}
            onChangeText={setDescRu}
            multiline
            placeholderTextColor={colors.mutedForeground}
            style={[
              inputStyle,
              { height: 80, paddingTop: 12, textAlignVertical: "top" },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>{t("trainingsCoach.form.descEn")}</Text>
          <TextInput
            testID="input-desc-en"
            value={descEn}
            onChangeText={setDescEn}
            multiline
            placeholderTextColor={colors.mutedForeground}
            style={[
              inputStyle,
              { height: 80, paddingTop: 12, textAlignVertical: "top" },
            ]}
          />
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
          testID="button-save-training"
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: canSubmit ? colors.primary : colors.muted,
              borderRadius: colors.radius,
              opacity: pressed && canSubmit ? 0.88 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.submitText,
              {
                color: canSubmit
                  ? colors.primaryForeground
                  : colors.mutedForeground,
              },
            ]}
          >
            {create.isPending
              ? t("trainingsCoach.form.saving")
              : t("trainingsCoach.form.save")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 18 },
  field: { gap: 10 },
  row: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
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
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600" as const,
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
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
});
