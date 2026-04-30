import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddressInput } from "../components/AddressInput";
import { Required } from "../components/Required";
import { openInCalendar } from "../lib/addToCalendar";
import { useCare } from "../lib/careContext";
import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

type FacilityType = "hospital" | "assisted_living" | "dialysis" | "other";

const FACILITY_TYPE_OPTIONS: { value: FacilityType; label: string }[] = [
  { value: "hospital", label: "Hospital / Surgical Center" },
  { value: "assisted_living", label: "Assisted Living / Nursing Home" },
  { value: "dialysis", label: "Dialysis Center" },
  { value: "other", label: "Other Medical Facility" },
];

const FACILITIES_BY_TYPE: Record<FacilityType, string[]> = {
  hospital: [
    "OhioHealth Riverside Methodist Hospital",
    "OhioHealth Grant Medical Center",
    "Wexner Medical Center OSU",
    "Mount Carmel St. Ann's",
    "Nationwide Children's Hospital",
  ],
  assisted_living: [
    "Brookdale Columbus (Assisted Living)",
    "Sunrise Senior Living Columbus",
    "Danbury Senior Living Columbus",
    "The Gables of Westerville",
    "Atria Columbus",
  ],
  dialysis: [
    "DaVita Columbus East",
    "DaVita Westerville",
    "Fresenius Kidney Care Columbus",
    "US Renal Care Columbus",
  ],
  other: [],
};

const OTHER_OPTION = "Other - I'll type it in";

const ALL_FACILITIES: string[] = [
  ...FACILITIES_BY_TYPE.hospital,
  ...FACILITIES_BY_TYPE.assisted_living,
  ...FACILITIES_BY_TYPE.dialysis,
  OTHER_OPTION,
];

function matchHospital(name: string | undefined): string | null {
  if (!name) return null;
  const target = name.toLowerCase();
  for (const h of ALL_FACILITIES) {
    const opt = h.toLowerCase();
    if (opt === target || opt.includes(target) || target.includes(opt))
      return h;
  }
  // simple keyword match
  if (target.includes("riverside")) return ALL_FACILITIES[0];
  if (target.includes("grant")) return ALL_FACILITIES[1];
  if (target.includes("wexner") || target.includes("osu"))
    return ALL_FACILITIES[2];
  if (target.includes("st. ann") || target.includes("mount carmel"))
    return ALL_FACILITIES[3];
  if (target.includes("nationwide") || target.includes("children"))
    return ALL_FACILITIES[4];
  if (target.includes("davita") && target.includes("east"))
    return "DaVita Columbus East";
  if (target.includes("davita")) return "DaVita Westerville";
  if (target.includes("fresenius")) return "Fresenius Kidney Care Columbus";
  if (target.includes("renal")) return "US Renal Care Columbus";
  if (target.includes("brookdale"))
    return "Brookdale Columbus (Assisted Living)";
  if (target.includes("sunrise")) return "Sunrise Senior Living Columbus";
  if (target.includes("danbury")) return "Danbury Senior Living Columbus";
  if (target.includes("gables")) return "The Gables of Westerville";
  if (target.includes("atria")) return "Atria Columbus";
  return null;
}

function inferFacilityType(name: string): FacilityType {
  for (const t of [
    "hospital",
    "assisted_living",
    "dialysis",
  ] as FacilityType[]) {
    if (FACILITIES_BY_TYPE[t].includes(name)) return t;
  }
  return "other";
}

function parseTimeToDate(t: string | undefined): Date | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date();
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? null : d;
}

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
  const params = useLocalSearchParams<{ prefill?: string }>();
  const {
    activePerson,
    careRecipients,
    selfPatientId,
    selfFullName,
    setActivePersonById,
    loading: careLoading,
  } = useCare();
  const activePatientId = activePerson?.patientId ?? null;
  const isSelf = !!activePerson?.isSelf;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  // Pre-step: "Who is this ride for?" — only shown when the user actually has
  // people in their care. If there are none, we skip straight to surgery details.
  const [whoChosen, setWhoChosen] = useState(false);
  const showWhoPicker =
    !careLoading && careRecipients.length > 0 && !whoChosen && step === 1;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  // Step 1
  const [surgeryDate, setSurgeryDate] = useState<Date | null>(null);
  const [surgeryTime, setSurgeryTime] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [facilityType, setFacilityType] = useState<FacilityType>("hospital");
  const [hospital, setHospital] = useState<string>("");
  const [hospitalCustom, setHospitalCustom] = useState<string>("");
  const [procedureType, setProcedureType] = useState("");

  // Step 2
  const [rideType, setRideType] = useState<RideType>("pre_op");
  const [pickupAddress, setPickupAddress] = useState("");
  const [needsWheelchair, setNeedsWheelchair] = useState(false);
  const [bringingCompanion, setBringingCompanion] = useState(false);
  const [needsExtraTime, setNeedsExtraTime] = useState(false);

  // Step 3
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("hsa_fsa");
  const [hsaCardOnFile, setHsaCardOnFile] = useState<string | null>(null);
  const [stdCardOnFile, setStdCardOnFile] = useState<string | null>(null);
  const [receiptEmail, setReceiptEmail] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedRideForCalendar, setBookedRideForCalendar] = useState<{
    title: string;
    startISO: string;
    endISO: string;
    location: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const targetId = activePatientId ?? userId;

      // Load the booking patient's home address (pickup default).
      const { data: pat } = await supabase
        .from("patients")
        .select("home_address, email")
        .eq("id", targetId)
        .maybeSingle();
      if (pat?.home_address) setPickupAddress(pat.home_address);

      // Receipt email: caregiver's email is the primary receipient (their card pays).
      // We always send to the caregiver's account email on file.
      const { data: payer } = await supabase
        .from("patients")
        .select("email, hsa_fsa_card_token, stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();
      if (payer?.email) setReceiptEmail(payer.email);
      else if (pat?.email) setReceiptEmail(pat.email);
      if (payer?.hsa_fsa_card_token) {
        const m = payer.hsa_fsa_card_token.match(/(\d{4})$/);
        setHsaCardOnFile(m ? m[1] : "••••");
      }
      if (payer?.stripe_customer_id) {
        const m = payer.stripe_customer_id.match(/(\d{4})$/);
        setStdCardOnFile(m ? m[1] : "••••");
      }
    })();
  }, [activePatientId]);

  // Pre-fill from AI extraction
  useEffect(() => {
    if (!params.prefill) return;
    try {
      const p = JSON.parse(params.prefill) as {
        surgery_date?: string;
        surgery_time?: string;
        hospital_name?: string;
        procedure_type?: string;
        needs_wheelchair?: boolean;
        needs_companion?: boolean;
        special_instructions?: string;
      };
      const d = parseDate(p.surgery_date);
      const t = parseTimeToDate(p.surgery_time);
      if (d) setSurgeryDate(d);
      if (t) setSurgeryTime(t);
      if (p.procedure_type) setProcedureType(p.procedure_type);
      const matched = matchHospital(p.hospital_name);
      if (matched) {
        setHospital(matched);
        setFacilityType(inferFacilityType(matched));
      } else if (p.hospital_name) {
        setHospital(OTHER_OPTION);
        setFacilityType("other");
        setHospitalCustom(p.hospital_name);
      }
      if (p.needs_wheelchair) setNeedsWheelchair(true);
      if (p.needs_companion) setBringingCompanion(true);
      if (p.special_instructions) {
        // surface as needing extra time if relevant; otherwise ignored quietly
        if (/extra time|slow|mobility|assist/i.test(p.special_instructions))
          setNeedsExtraTime(true);
      }
      setStep(3);
    } catch {
      // ignore malformed prefill
    }
  }, [params.prefill]);

  const finalHospitalName = (): string => {
    if (hospital.startsWith("Other")) return hospitalCustom.trim();
    return hospital;
  };

  const validateStep1 = (): string | null => {
    if (!surgeryDate) return "Please select date";
    if (!surgeryTime) return "Please select time";
    if (!hospital) return "Please select a destination facility";
    if (hospital.startsWith("Other") && !hospitalCustom.trim())
      return "Please type the facility name";
    if (!procedureType.trim())
      return "Please enter the procedure or visit type";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!pickupAddress.trim()) return "Please enter a pickup address";
    return null;
  };

  const next = () => {
    setError(null);
    const err =
      step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => (s >= 4 ? 4 : ((s + 1) as 1 | 2 | 3 | 4)));
  };

  const back = () => {
    setError(null);
    if (step === 1) {
      // If the user has care recipients, the first thing they saw was the
      // "Who is this ride for?" picker — return to it instead of leaving.
      if (careRecipients.length > 0 && whoChosen) {
        setWhoChosen(false);
        return;
      }
      router.back();
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const playSuccessAnimation = () => {
    checkScale.setValue(0);
    checkOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const submit = async () => {
    setError(null);
    const needsCard =
      paymentMethod === "hsa_fsa" ? !hsaCardOnFile : !stdCardOnFile;
    if (needsCard) {
      setError(
        paymentMethod === "hsa_fsa"
          ? "Please add an HSA/FSA card from the Payment tab to continue."
          : "Please add a card from the Payment tab to continue.",
      );
      return;
    }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const bookingPatientId = activePatientId ?? userId;
    if (!userId || !bookingPatientId || !surgeryDate || !surgeryTime) {
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
        patient_id: bookingPatientId,
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
    // Save first ride details for "Add to Calendar" button on success screen.
    // We use the surgery date/time itself as the calendar reminder so the user
    // sees their appointment in their calendar (with pickup time noted).
    const firstRow = rows[0];
    const calendarStart = new Date(surgeryDateTime);
    const calendarEnd = new Date(surgeryDateTime);
    calendarEnd.setHours(calendarEnd.getHours() + 1);
    const pickupLocal = new Date(firstRow.pickup_time).toLocaleString(
      undefined,
      { weekday: "short", hour: "numeric", minute: "2-digit" },
    );
    setBookedRideForCalendar({
      title: `${procedureType.trim() || "Medical appointment"} — CareVoy ride`,
      startISO: calendarStart.toISOString(),
      endISO: calendarEnd.toISOString(),
      location: hospitalName,
      description: `CareVoy ride booked.\n\nPickup: ${pickupLocal}\nFrom: ${firstRow.pickup_address}\nTo: ${firstRow.dropoff_address}${rows.length > 1 ? "\n\nReturn ride also booked." : ""}`,
    });
    setStep(4);
    playSuccessAnimation();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          {step !== 4 ? (
            <Pressable onPress={back} hitSlop={12}>
              <Feather name="chevron-left" size={26} color={NAVY} />
            </Pressable>
          ) : (
            <View style={{ width: 26 }} />
          )}
          <Text style={styles.topTitle}>Book a Ride</Text>
          <View style={{ width: 26 }} />
        </View>

        {!showWhoPicker ? (
          <View style={styles.progressWrap}>
            <View style={styles.progress}>
              {[1, 2, 3, 4].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.progressDot,
                    n <= step && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.progressText}>Step {step} of 4</Text>
          </View>
        ) : null}

        {showWhoPicker ? (
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.stepTitle}>Who is this ride for?</Text>
            <Text style={styles.stepSub}>
              Pick the person you're booking transportation for.
            </Text>

            {[
              {
                id: selfPatientId ?? "self",
                label: "Myself",
                sub: selfFullName ?? null,
                isSelf: true,
              },
              ...careRecipients.map((p) => ({
                id: p.patientId,
                label: p.fullName,
                sub: p.relationship ?? "In my care",
                isSelf: false,
              })),
            ].map((opt) => {
              const selected =
                (opt.isSelf && isSelf) ||
                (!opt.isSelf && activePatientId === opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={async () => {
                    const target =
                      opt.isSelf && selfPatientId ? selfPatientId : opt.id;
                    await setActivePersonById(target);
                    setWhoChosen(true);
                  }}
                  style={({ pressed }) => [
                    styles.whoCard,
                    selected && styles.whoCardSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View
                    style={[
                      styles.whoIcon,
                      selected && styles.whoIconSelected,
                    ]}
                  >
                    <Feather
                      name={opt.isSelf ? "user" : "users"}
                      size={18}
                      color={selected ? NAVY : TEAL}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whoCardTitle}>{opt.label}</Text>
                    {opt.sub ? (
                      <Text style={styles.whoCardSub}>{opt.sub}</Text>
                    ) : null}
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={selected ? NAVY : MUTED}
                  />
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => router.push("/care/add")}
              style={({ pressed }) => [
                styles.whoAddRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="plus-circle" size={18} color={TEAL} />
              <Text style={styles.whoAddText}>Add someone in my care</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {!showWhoPicker && !isSelf && activePerson && step !== 4 ? (
          <View style={styles.bookingForBanner}>
            <Feather name="users" size={14} color={TEAL} />
            <Text style={styles.bookingForText}>
              Booking for {activePerson.fullName}
            </Text>
          </View>
        ) : null}

        {!showWhoPicker ? (
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

              <Text style={styles.label}>
                Surgery date<Required />
              </Text>
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
                  themeVariant="light"
                  textColor={NAVY}
                  accentColor={TEAL}
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

              <Text style={styles.label}>
                Surgery time<Required />
              </Text>
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
                  themeVariant="light"
                  textColor={NAVY}
                  accentColor={TEAL}
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

              <Text style={styles.label}>Facility type</Text>
              <View style={styles.facilityTypeRow}>
                {FACILITY_TYPE_OPTIONS.map((opt) => {
                  const active = facilityType === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setFacilityType(opt.value);
                        setHospital("");
                        setHospitalCustom("");
                      }}
                      style={[
                        styles.facilityTypeChip,
                        active && styles.facilityTypeChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.facilityTypeChipText,
                          active && styles.facilityTypeChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>
                Destination Facility<Required />
              </Text>
              <FacilityAutocomplete
                value={hospital}
                customValue={hospitalCustom}
                facilityType={facilityType}
                onSelect={(name) => {
                  setHospital(name);
                  if (!name.startsWith("Other")) setHospitalCustom("");
                }}
                onCustomChange={setHospitalCustom}
              />

              <Text style={styles.label}>Procedure / visit type</Text>
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
                {[
                  { v: "pre_op" as RideType, label: "Pre-op" },
                  { v: "post_op" as RideType, label: "Post-op" },
                  { v: "both" as RideType, label: "Both" },
                ].map((opt) => (
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

              <Text style={styles.label}>
                Pickup address<Required />
              </Text>
              <AddressInput
                value={pickupAddress}
                onChange={setPickupAddress}
                placeholder="Start typing your address…"
                multiline
                inputStyle={styles.addressInput}
                zIndex={50}
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

              <SummaryRow
                label="Surgery"
                value={`${formatDate(surgeryDate)} • ${formatTime(surgeryTime)}`}
              />
              <SummaryRow label="Destination" value={finalHospitalName()} />
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
                subtitle={
                  hsaCardOnFile
                    ? `Card on file ending in ${hsaCardOnFile} • Tax-free`
                    : "Tax-advantaged. We'll generate an IRS-ready receipt."
                }
              />
              <PaymentOption
                active={paymentMethod === "card"}
                onPress={() => setPaymentMethod("card")}
                icon="credit-card"
                title="Credit or debit card"
                subtitle={
                  stdCardOnFile
                    ? `Card on file ending in ${stdCardOnFile}`
                    : "Standard payment."
                }
              />

              {((paymentMethod === "hsa_fsa" && !hsaCardOnFile) ||
                (paymentMethod === "card" && !stdCardOnFile)) && (
                <Pressable
                  style={styles.addCardPrompt}
                  onPress={() => router.push("/(tabs)/payment")}
                >
                  <Feather name="plus-circle" size={18} color={TEAL} />
                  <Text style={styles.addCardText}>
                    Add{" "}
                    {paymentMethod === "hsa_fsa" ? "HSA/FSA card" : "a card"} to
                    continue
                  </Text>
                  <Feather name="chevron-right" size={18} color={TEAL} />
                </Pressable>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.successWrap}>
              <Animated.View
                style={[
                  styles.successCircle,
                  {
                    opacity: checkOpacity,
                    transform: [{ scale: checkScale }],
                  },
                ]}
              >
                <Feather name="check" size={56} color={NAVY} />
              </Animated.View>
              <Text style={styles.successTitle}>Your ride is booked</Text>
              <Text style={styles.successSub}>
                We&apos;ve saved your request. A care coordinator will confirm
                your driver shortly and you&apos;ll get a text when they&apos;re
                on the way.
              </Text>
              {(paymentMethod === "hsa_fsa"
                ? hsaCardOnFile
                : stdCardOnFile) && (
                <View style={styles.chargeBox}>
                  <Feather name="credit-card" size={18} color={TEAL} />
                  <Text style={styles.chargeText}>
                    Your {paymentMethod === "hsa_fsa" ? "HSA/FSA" : "card"}{" "}
                    ending in{" "}
                    {paymentMethod === "hsa_fsa"
                      ? hsaCardOnFile
                      : stdCardOnFile}{" "}
                    will be charged{" "}
                    <Text style={styles.chargeAmount}>
                      ${rideType === "both" ? "110" : "55"}
                    </Text>{" "}
                    after your ride completes.
                    {receiptEmail ? ` Receipt sent to ${receiptEmail}.` : ""}
                  </Text>
                </View>
              )}
              {bookedRideForCalendar ? (
                <Pressable
                  onPress={() => {
                    void openInCalendar(bookedRideForCalendar);
                  }}
                  style={({ pressed }) => [
                    styles.calBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Add ride reminder to calendar"
                >
                  <Feather name="calendar" size={18} color={TEAL} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calBtnTitle}>Add to my calendar</Text>
                    <Text style={styles.calBtnSub}>
                      Save a reminder to Google, Apple, or Outlook calendar
                    </Text>
                  </View>
                  <Feather name="external-link" size={16} color={MUTED} />
                </Pressable>
              ) : null}
            </View>
          )}

          {step !== 4 && error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}
        </ScrollView>
        ) : null}

        {!showWhoPicker ? (
        <View style={styles.footer}>
          {step === 4 ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
              ]}
              onPress={() => router.replace("/(tabs)")}
            >
              <Text style={styles.primaryBtnText}>Back to Home</Text>
            </Pressable>
          ) : step === 3 ? (
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
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FacilityAutocomplete({
  value,
  customValue,
  facilityType,
  onSelect,
  onCustomChange,
}: {
  value: string;
  customValue: string;
  facilityType: FacilityType;
  onSelect: (name: string) => void;
  onCustomChange: (name: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const isOther = value.startsWith("Other");
  const displayValue = focused ? query : isOther ? "" : value;

  const choices = useMemo(() => {
    const list =
      facilityType === "other"
        ? []
        : [...FACILITIES_BY_TYPE[facilityType]];
    return list;
  }, [facilityType]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter((c) => c.toLowerCase().includes(q));
  }, [choices, query]);

  return (
    <>
      <View style={facilityStyles.wrap}>
        <View style={facilityStyles.inputBox}>
          <TextInput
            style={facilityStyles.input}
            placeholder="Start typing facility name…"
            placeholderTextColor={MUTED}
            value={displayValue}
            onChangeText={(t) => {
              setQuery(t);
              if (!focused) setFocused(true);
            }}
            onFocus={() => {
              setFocused(true);
              setQuery(isOther ? customValue : value);
            }}
            onBlur={() => {
              setTimeout(() => setFocused(false), 180);
            }}
          />
          <Feather name="search" size={18} color={MUTED} />
        </View>
        {focused ? (
          <View style={facilityStyles.dropdown}>
            {filtered.map((name, idx) => (
              <Pressable
                key={name}
                style={({ pressed }) => [
                  facilityStyles.row,
                  idx === filtered.length - 1 && filtered.length > 0
                    ? null
                    : facilityStyles.rowDivider,
                  pressed && facilityStyles.rowPressed,
                ]}
                onPress={() => {
                  onSelect(name);
                  setQuery(name);
                  setFocused(false);
                }}
              >
                <Text style={facilityStyles.rowText}>{name}</Text>
                {value === name ? (
                  <Feather name="check" size={16} color={TEAL} />
                ) : null}
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [
                facilityStyles.row,
                facilityStyles.rowOther,
                pressed && facilityStyles.rowPressed,
              ]}
              onPress={() => {
                onSelect(OTHER_OPTION);
                if (query.trim()) onCustomChange(query.trim());
                setFocused(false);
              }}
            >
              <Feather name="plus-circle" size={16} color={TEAL} />
              <Text style={facilityStyles.rowOtherText}>
                {query.trim()
                  ? `Use "${query.trim()}"`
                  : "Other - I'll type it in"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {isOther ? (
        <TextInput
          style={facilityStyles.customInput}
          placeholder="Facility name"
          placeholderTextColor={MUTED}
          value={customValue}
          onChangeText={onCustomChange}
        />
      ) : null}
    </>
  );
}

const facilityStyles = StyleSheet.create({
  wrap: { position: "relative", zIndex: 100 },
  inputBox: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    flex: 1,
    color: NAVY,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    paddingVertical: 12,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    marginTop: 6,
    maxHeight: 280,
    overflow: "hidden",
    boxShadow: "0px 6px 18px rgba(5,13,31,0.12)",
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowPressed: { backgroundColor: CARD },
  rowText: { color: NAVY, fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  rowOther: {
    backgroundColor: "rgba(0,194,168,0.06)",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 8,
    justifyContent: "flex-start",
  },
  rowOtherText: {
    color: NAVY,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  customInput: {
    backgroundColor: CARD,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});

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
      <View style={[styles.payIcon, active && { backgroundColor: TEAL }]}>
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
  safe: { flex: 1, backgroundColor: WHITE },
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
    color: NAVY,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  progressWrap: { paddingHorizontal: 24, marginBottom: 8 },
  progress: {
    flexDirection: "row",
    gap: 6,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
  },
  progressDotActive: { backgroundColor: TEAL },
  progressText: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
    fontFamily: "Inter_500Medium",
  },
  calBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    width: "100%",
  },
  calBtnTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  calBtnSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  bookingForBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(0,194,168,0.12)",
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  bookingForText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  whoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  whoCardSelected: {
    borderColor: TEAL,
    backgroundColor: "rgba(0,194,168,0.08)",
  },
  whoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,194,168,0.12)",
  },
  whoIconSelected: {
    backgroundColor: TEAL,
  },
  whoCardTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  whoCardSub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  whoAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  whoAddText: {
    color: TEAL,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  successWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 12,
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  successTitle: {
    color: NAVY,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  successSub: {
    color: MUTED,
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  container: { padding: 24, paddingBottom: 24 },
  stepTitle: {
    color: NAVY,
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
    color: NAVY,
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
    color: NAVY,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  facilityTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  facilityTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  facilityTypeChipActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  facilityTypeChipText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  facilityTypeChipTextActive: {
    color: NAVY,
  },
  multiline: { minHeight: 60, textAlignVertical: "top", paddingTop: 14 },
  addressInput: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: BORDER,
    color: NAVY,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  inputText: { color: NAVY, fontSize: 16, fontFamily: "Inter_500Medium" },
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
    color: NAVY,
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
  checkLabel: { color: NAVY, fontSize: 15, fontFamily: "Inter_500Medium" },
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
    color: NAVY,
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
    color: NAVY,
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
    color: NAVY,
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
  addCardPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
    borderStyle: "dashed",
    backgroundColor: "rgba(0,194,168,0.06)",
  },
  addCardText: {
    flex: 1,
    color: TEAL,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  chargeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  chargeText: {
    flex: 1,
    color: NAVY,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  chargeAmount: {
    color: TEAL,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
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
    backgroundColor: WHITE,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalTitle: {
    color: NAVY,
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
    color: NAVY,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    flex: 1,
    paddingRight: 12,
  },
});
