import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#8A93A6";
const CARD = "#0E1A33";
const BORDER = "#1B2A4A";
const ERROR = "#FF6B6B";

const HOSPITALS = [
  "OhioHealth Riverside Methodist Hospital",
  "OhioHealth Grant Medical Center",
  "Wexner Medical Center OSU",
  "Mount Carmel St. Ann's",
  "Nationwide Children's Hospital",
  "Other - I'll type it in",
];

type RideType = "pre_op" | "post_op" | "both";
type PaymentMethod = "hsa_fsa" | "card";

function combineDateTime(date: Date, time: Date): Date {
  const out = new Date(date);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
}

function formatDate(d: Date | null): string {
  if (!d) return "Select date";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(d: Date | null): string {
  if (!d) return "Select time";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookRideScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [surgeryDate, setSurgeryDate] = useState<Date | null>(null);
  const [surgeryTime, setSurgeryTime] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [hospital, setHospital] = useState<string>("");
  const [hospitalCustom, setHospitalCustom] = useState<string>("");
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false);
  const [procedureType, setProcedureType] = useState("");

  // Step 2
  const [rideType, setRideType] = useState<RideType>("pre_op");
  const [pickupAddress, setPickupAddress] = useState("");
  const [needsWheelchair, setNeedsWheelchair] = useState(false);
  const [bringingCompanion, setBringingCompanion] = useState(false);
  const [needsExtraTime, setNeedsExtraTime] = useState(false);

  // Step 3
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("hsa_fsa");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("patients")
        .select("home_address")
        .eq("id", userId)
        .maybeSingle();
      if (data?.home_address) setPickupAddress(data.home_address);
    })();
  }, []);

  const hospitalDisplay = (): string => {
    if (!hospital) return "Select hospital";
    if (hospital.startsWith("Other"))
      return hospitalCustom.trim() || "Other (type in below)";
    return hospital;
  };

  const finalHospitalName = (): string => {
    if (hospital.startsWith("Other")) return hospitalCustom.trim();
    return hospital;
  };

  const validateStep1 = (): string | null => {
    if (!surgeryDate) return "Please select surgery date";
    if (!surgeryTime) return "Please select surgery time";
    if (!hospital) return "Please select a hospital";
    if (hospital.startsWith("Other") && !hospitalCustom.trim())
      return "Please type the hospital name";
    if (!procedureType.trim()) return "Please enter the procedure type";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!pickupAddress.trim()) return "Please enter a pickup address";
    return null;
  };

  const next = () => {
    setError(null);
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
  };

  const back = () => {
    setError(null);
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3);
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId || !surgeryDate || !surgeryTime) {
      setSubmitting(false);
      setError("Missing user or schedule info");
      return;
    }

    const surgeryDateTime = combineDateTime(surgeryDate, surgeryTime);
    const surgeryDateStr = surgeryDate.toISOString().slice(0, 10);
    const hospitalName = finalHospitalName();
    const mobilityParts: string[] = [];
    if (needsWheelchair) mobilityParts.push("Wheelchair accessible vehicle");
    if (needsExtraTime) mobilityParts.push("Needs extra time getting in/out");
    const mobility = mobilityParts.join("; ") || null;

    const types: ("pre_op" | "post_op")[] =
      rideType === "both" ? ["pre_op", "post_op"] : [rideType];

    const rows = types.map((t) => {
      const isPre = t === "pre_op";
      // For post-op, swap pickup and dropoff
      const pickup = isPre ? pickupAddress.trim() : hospitalName;
      const dropoff = isPre ? hospitalName : pickupAddress.trim();
      // Pre-op pickup: 90 minutes before surgery. Post-op pickup: 2 hours after.
      const pickupTime = new Date(surgeryDateTime);
      if (isPre) pickupTime.setMinutes(pickupTime.getMinutes() - 90);
      else pickupTime.setHours(pickupTime.getHours() + 2);

      return {
        patient_id: userId,
        ride_type: t,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_time: pickupTime.toISOString(),
        surgery_date: surgeryDateStr,
        procedure_type: procedureType.trim(),
        mobility_needs: mobility,
        companion_requested: bringingCompanion,
        status: "pending",
        estimated_cost: 55,
      };
    });

    const { error: insertErr } = await supabase.from("rides").insert(rows);
    setSubmitting(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <Pressable onPress={back} hitSlop={12}>
            <Feather name="chevron-left" size={26} color={WHITE} />
          </Pressable>
          <Text style={styles.topTitle}>Book a Ride</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.progress}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={[styles.progressDot, n <= step && styles.progressDotActive]}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Surgery details</Text>
              <Text style={styles.stepSub}>
                When and where is your procedure?
              </Text>

              <Text style={styles.label}>Surgery date</Text>
              <Pressable style={styles.input} onPress={() => setShowDate(true)}>
                <Text
                  style={[styles.inputText, !surgeryDate && styles.placeholder]}
                >
                  {formatDate(surgeryDate)}
                </Text>
                <Feather name="calendar" size={18} color={MUTED} />
              </Pressable>
              {showDate && (
                <DateTimePicker
                  value={surgeryDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={new Date()}
                  themeVariant="dark"
                  onChange={(_e: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS !== "ios") setShowDate(false);
                    if (d) setSurgeryDate(d);
                  }}
                />
              )}
              {showDate && Platform.OS === "ios" && (
                <Pressable
                  style={styles.doneBtn}
                  onPress={() => setShowDate(false)}
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              )}

              <Text style={styles.label}>Surgery time</Text>
              <Pressable style={styles.input} onPress={() => setShowTime(true)}>
                <Text
                  style={[styles.inputText, !surgeryTime && styles.placeholder]}
                >
                  {formatTime(surgeryTime)}
                </Text>
                <Feather name="clock" size={18} color={MUTED} />
              </Pressable>
              {showTime && (
                <DateTimePicker
                  value={surgeryTime ?? new Date()}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant="dark"
                  onChange={(_e: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS !== "ios") setShowTime(false);
                    if (d) setSurgeryTime(d);
                  }}
                />
              )}
              {showTime && Platform.OS === "ios" && (
                <Pressable
                  style={styles.doneBtn}
                  onPress={() => setShowTime(false)}
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              )}

              <Text style={styles.label}>Hospital</Text>
              <Pressable
                style={styles.input}
                onPress={() => setHospitalPickerOpen(true)}
              >
                <Text
                  style={[styles.inputText, !hospital && styles.placeholder]}
                  numberOfLines={1}
                >
                  {hospitalDisplay()}
                </Text>
                <Feather name="chevron-down" size={18} color={MUTED} />
              </Pressable>
              {hospital.startsWith("Other") && (
                <TextInput
                  style={[styles.input, styles.textOnly]}
                  placeholder="Type hospital name"
                  placeholderTextColor={MUTED}
                  value={hospitalCustom}
                  onChangeText={setHospitalCustom}
                />
              )}

              <Text style={styles.label}>Procedure type</Text>
              <TextInput
                style={[styles.input, styles.textOnly]}
                placeholder="e.g. Knee replacement, Cataract surgery"
                placeholderTextColor={MUTED}
                value={procedureType}
                onChangeText={setProcedureType}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Ride details</Text>
              <Text style={styles.stepSub}>
                Pickup info and any special needs.
              </Text>

              <Text style={styles.label}>Ride type</Text>
              <View style={styles.toggleRow}>
                {(
                  [
                    { v: "pre_op" as RideType, label: "Pre-op" },
                    { v: "post_op" as RideType, label: "Post-op" },
                    { v: "both" as RideType, label: "Both" },
                  ]
                ).map((opt) => (
                  <Pressable
                    key={opt.v}
                    style={[
                      styles.toggle,
                      rideType === opt.v && styles.toggleActive,
                    ]}
                    onPress={() => setRideType(opt.v)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        rideType === opt.v && styles.toggleTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Pickup address</Text>
              <TextInput
                style={[styles.input, styles.textOnly, styles.multiline]}
                placeholder="Street, city, state"
                placeholderTextColor={MUTED}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                multiline
              />

              <Text style={styles.label}>Special needs</Text>
              <Checkbox
                label="Wheelchair accessible vehicle"
                value={needsWheelchair}
                onChange={setNeedsWheelchair}
              />
              <Checkbox
                label="Bringing a companion"
                value={bringingCompanion}
                onChange={setBringingCompanion}
              />
              <Checkbox
                label="Need extra time getting in/out"
                value={needsExtraTime}
                onChange={setNeedsExtraTime}
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Review & confirm</Text>
              <Text style={styles.stepSub}>
                Double check everything before booking.
              </Text>

              <SummaryRow label="Surgery" value={`${formatDate(surgeryDate)} • ${formatTime(surgeryTime)}`} />
              <SummaryRow label="Hospital" value={finalHospitalName()} />
              <SummaryRow label="Procedure" value={procedureType} />
              <SummaryRow
                label="Ride"
                value={
                  rideType === "pre_op"
                    ? "Pre-op only"
                    : rideType === "post_op"
                      ? "Post-op only"
                      : "Pre-op + Post-op"
                }
              />
              <SummaryRow label="Pickup" value={pickupAddress} />
              {(needsWheelchair || bringingCompanion || needsExtraTime) && (
                <SummaryRow
                  label="Special needs"
                  value={[
                    needsWheelchair && "Wheelchair vehicle",
                    bringingCompanion && "Companion",
                    needsExtraTime && "Extra time",
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                />
              )}

              <View style={styles.estimateCard}>
                <View>
                  <Text style={styles.estimateLabel}>Estimated cost</Text>
                  <Text style={styles.estimateNote}>
                    {rideType === "both" ? "Per ride" : "One ride"}
                  </Text>
                </View>
                <Text style={styles.estimateValue}>$45–65</Text>
              </View>

              <Text style={styles.label}>Payment method</Text>
              <PaymentOption
                active={paymentMethod === "hsa_fsa"}
                onPress={() => setPaymentMethod("hsa_fsa")}
                icon="credit-card"
                title="HSA / FSA card"
                subtitle="Tax-advantaged. We'll generate an IRS-ready receipt."
              />
              <PaymentOption
                active={paymentMethod === "card"}
                onPress={() => setPaymentMethod("card")}
                icon="credit-card"
                title="Credit or debit card"
                subtitle="Standard payment."
              />
              <Text style={styles.footnote}>
                Payment cards can be added in the next step after booking.
              </Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {step === 3 ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                (submitting || pressed) && styles.pressed,
              ]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <Text style={styles.primaryBtnText}>Confirm Booking</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
              ]}
              onPress={next}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={hospitalPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHospitalPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setHospitalPickerOpen(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select hospital</Text>
            {HOSPITALS.map((h) => (
              <Pressable
                key={h}
                style={styles.modalRow}
                onPress={() => {
                  setHospital(h);
                  setHospitalPickerOpen(false);
                }}
              >
                <Text style={styles.modalRowText}>{h}</Text>
                {hospital === h && (
                  <Feather name="check" size={18} color={TEAL} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Checkbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.checkRow} onPress={() => onChange(!value)}>
      <View style={[styles.checkBox, value && styles.checkBoxOn]}>
        {value && <Feather name="check" size={16} color={NAVY} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PaymentOption({
  active,
  onPress,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      style={[styles.payOpt, active && styles.payOptActive]}
      onPress={onPress}
    >
      <View
        style={[styles.payIcon, active && { backgroundColor: TEAL }]}
      >
        <Feather name={icon} size={18} color={active ? NAVY : TEAL} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.payTitle}>{title}</Text>
        <Text style={styles.paySub}>{subtitle}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioOn]}>
        {active && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  topTitle: {
    color: WHITE,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  progress: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
  },
  progressDotActive: { backgroundColor: TEAL },
  container: { padding: 24, paddingBottom: 24 },
  stepTitle: {
    color: WHITE,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  stepSub: {
    color: MUTED,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 18,
    fontFamily: "Inter_400Regular",
  },
  label: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: BORDER,
  },
  textOnly: {
    color: WHITE,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  multiline: { minHeight: 60, textAlignVertical: "top", paddingTop: 14 },
  inputText: { color: WHITE, fontSize: 16, fontFamily: "Inter_500Medium" },
  placeholder: { color: MUTED },
  doneBtn: { alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 4 },
  doneBtnText: {
    color: TEAL,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: CARD,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  toggleActive: { backgroundColor: TEAL, borderColor: TEAL },
  toggleText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  toggleTextActive: { color: NAVY },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: TEAL, borderColor: TEAL },
  checkLabel: { color: WHITE, fontSize: 15, fontFamily: "Inter_500Medium" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 16,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    width: 110,
  },
  summaryValue: {
    color: WHITE,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
    textAlign: "right",
  },
  estimateCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  estimateLabel: {
    color: WHITE,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  estimateNote: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  estimateValue: {
    color: TEAL,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  payOpt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  payOptActive: { borderColor: TEAL },
  payIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(0,194,168,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  payTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  paySub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: TEAL },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },
  footnote: {
    color: MUTED,
    fontSize: 12,
    marginTop: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryBtnText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  pressed: { opacity: 0.85 },
  error: {
    color: ERROR,
    fontSize: 13,
    marginTop: 14,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalRowText: {
    color: WHITE,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    flex: 1,
    paddingRight: 12,
  },
});
