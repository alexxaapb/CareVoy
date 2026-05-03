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

function buildSurgeryDate(
  m: string,
  d: string,
  y: string,
): Date | null {
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const year = parseInt(y, 10);
  if (!month || !day || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2025 || year > 2100) return null;
  const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

function buildSurgeryTime(
  hr: string,
  min: string,
  ampm: "AM" | "PM",
): Date | null {
  const h = parseInt(hr, 10);
  const m = parseInt(min, 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (h < 1 || h > 12) return null;
  if (m < 0 || m > 59) return null;
  let h24 = h % 12;
  if (ampm === "PM") h24 += 12;
  const d = new Date();
  d.setHours(h24, m, 0, 0);
  return d;
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return digits ? "+" + digits : "";
}

function isValidEmail(s: string): boolean {
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
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
    refresh: refreshCare,
    loading: careLoading,
  } = useCare();
  const activePatientId = activePerson?.patientId ?? null;
  const isSelf = !!activePerson?.isSelf;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  // Pre-step: "Who is this ride for?" — always shown so the patient confirms
  // they're booking for themselves vs someone else (and can add a one-time
  // recipient inline without going to the full add-care-recipient screen).
  const [whoChosen, setWhoChosen] = useState(false);
  // Picker is the first thing every user sees on step 1 — we intentionally
  // don't gate on `careLoading` so it appears instantly even while the
  // recipient list is still being fetched in the background.
  const showWhoPicker = !whoChosen && step === 1;
  // Inline "Someone else" guest entry on the picker screen.
  const [guestExpanded, setGuestExpanded] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const guestRelationship = "Other";
  const [guestConsent, setGuestConsent] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestSaving, setGuestSaving] = useState(false);
  // True after the user finalized a one-off recipient on the picker screen
  // — the booking flow proceeds with that newly-created patient as the active person.
  const [bookingForGuest, setBookingForGuest] = useState(false);
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  // Step 1
  const [surgeryDate, setSurgeryDate] = useState<Date | null>(null);
  const [surgeryTime, setSurgeryTime] = useState<Date | null>(null);
  const [dateMonth, setDateMonth] = useState("");
  const [dateDay, setDateDay] = useState("");
  const [dateYear, setDateYear] = useState("");
  const [timeHour, setTimeHour] = useState("");
  const [timeMinute, setTimeMinute] = useState("");
  const [timeAmPm, setTimeAmPm] = useState<"AM" | "PM">("AM");
  const dateDayRef = useRef<TextInput>(null);
  const dateYearRef = useRef<TextInput>(null);
  const timeMinRef = useRef<TextInput>(null);
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

  // Demo mode: prefill the entire form and (optionally) jump to a step
  // via `?demoStep=N`. Used for investor pitch-deck screenshots.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const demoOn =
        params.get("demo") === "1" ||
        window.sessionStorage.getItem("__cv_demo") === "1";
      if (!demoOn) return;
      setSurgeryDate(new Date(2026, 4, 9, 9, 30, 0));
      setSurgeryTime(new Date(2026, 4, 9, 9, 30, 0));
      setDateMonth("05");
      setDateDay("09");
      setDateYear("2026");
      setTimeHour("9");
      setTimeMinute("30");
      setTimeAmPm("AM");
      setFacilityType("hospital");
      setHospital("OhioHealth Riverside Methodist Hospital");
      setProcedureType("Outpatient knee arthroscopy");
      setRideType("pre_op");
      setPickupAddress("850 N High St, Columbus, OH 43215");
      setBringingCompanion(true);
      setPaymentMethod("hsa_fsa");
      setHsaCardOnFile("Visa •••• 4242");
      setStdCardOnFile("Visa •••• 4242");
      setReceiptEmail("janedoe@gmail.com");
      const stepParam = parseInt(params.get("demoStep") ?? "", 10);
      if (!Number.isNaN(stepParam) && stepParam >= 1 && stepParam <= 4) {
        setWhoChosen(true);
        setStep(stepParam as 1 | 2 | 3 | 4);
      }
    } catch {
      // ignore
    }
  }, []);

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
      // Investor-screenshot-safe demo default: always seed the pickup with
      // a clean Columbus, OH address regardless of what's in the DB so the
      // ride summary never leaks a real personal address.
      setPickupAddress("850 N High St, Columbus, OH 43215");
      void pat?.home_address;

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

  // Sync text inputs → surgeryDate/surgeryTime whenever they change.
  useEffect(() => {
    const d = buildSurgeryDate(dateMonth, dateDay, dateYear);
    setSurgeryDate(d);
  }, [dateMonth, dateDay, dateYear]);
  useEffect(() => {
    const t = buildSurgeryTime(timeHour, timeMinute, timeAmPm);
    setSurgeryTime(t);
  }, [timeHour, timeMinute, timeAmPm]);

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
      if (d) {
        setDateMonth(String(d.getMonth() + 1));
        setDateDay(String(d.getDate()));
        setDateYear(String(d.getFullYear()));
      }
      if (t) {
        const h = t.getHours();
        const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        setTimeHour(String(h12));
        setTimeMinute(String(t.getMinutes()).padStart(2, "0"));
        setTimeAmPm(ampm);
      }
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
      // The first thing the user saw was the "Who is this ride for?" picker
      // — return to it instead of leaving the booking flow entirely.
      if (whoChosen) {
        setWhoChosen(false);
        return;
      }
      router.back();
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const saveGuestAndContinue = async () => {
    setGuestError(null);
    if (!guestName.trim()) {
      setGuestError("Please enter their full name.");
      return;
    }
    if (!guestPhone.trim() && !guestEmail.trim()) {
      setGuestError("Please add a phone number or email so we can reach them.");
      return;
    }
    if (guestEmail && !isValidEmail(guestEmail)) {
      setGuestError("That email address doesn't look right.");
      return;
    }
    if (!guestConsent) {
      setGuestError(
        "Please confirm you have permission to book a ride for this person.",
      );
      return;
    }
    setGuestSaving(true);
    // We use a placeholder home address — the real pickup is collected on
    // step 2 of the booking, so we just need a valid string here.
    const placeholderAddress =
      "Pickup address will be confirmed at booking";
    const { data, error: rpcErr } = await supabase.rpc("add_care_recipient", {
      p_full_name: guestName.trim(),
      p_phone: normalizePhone(guestPhone),
      p_email: guestEmail.trim(),
      p_dob: null,
      p_address: placeholderAddress,
      p_relationship: guestRelationship || "Other",
      p_consent_method: "app_checkbox",
    });
    if (rpcErr) {
      setGuestSaving(false);
      setGuestError(rpcErr.message);
      return;
    }
    const newId = typeof data === "string" ? data : null;
    if (newId) {
      // Refresh the care context first so the new patient is in
      // careRecipients, otherwise activePerson resolves to null and the
      // "Booking for [name]" banner won't render.
      await refreshCare();
      await setActivePersonById(newId);
      setBookingForGuest(true);
    }
    setGuestSaving(false);
    setWhoChosen(true);
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            <Text style={styles.stepTitle}>Who is this ride for?</Text>
            <Text style={styles.stepSub}>
              Pick the person you're booking transportation for.
            </Text>

            {[
              {
                id: selfPatientId ?? "self",
                label: "Myself",
                // Investor-screenshot-safe: never expose a phone number,
                // single-letter placeholder, or empty value as the subtitle.
                sub: ((): string => {
                  const raw = (selfFullName ?? "").trim();
                  const isPhoneish = /^[+\d\s()-]+$/.test(raw);
                  if (!raw || raw.length < 2 || isPhoneish) return "Jane";
                  return raw;
                })(),
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
                !guestExpanded &&
                ((opt.isSelf && isSelf) ||
                  (!opt.isSelf && activePatientId === opt.id));
              return (
                <Pressable
                  key={opt.id}
                  onPress={async () => {
                    const target =
                      opt.isSelf && selfPatientId ? selfPatientId : opt.id;
                    await setActivePersonById(target);
                    setBookingForGuest(false);
                    setGuestExpanded(false);
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

            {/* Someone else — inline guest entry */}
            <Pressable
              onPress={() => {
                setGuestExpanded((v) => !v);
                setGuestError(null);
              }}
              style={({ pressed }) => [
                styles.whoCard,
                guestExpanded && styles.whoCardSelected,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[
                  styles.whoIcon,
                  guestExpanded && styles.whoIconSelected,
                ]}
              >
                <Feather
                  name="user-plus"
                  size={18}
                  color={guestExpanded ? NAVY : TEAL}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whoCardTitle}>Someone else</Text>
                <Text style={styles.whoCardSub}>
                  Book a one-time ride for a friend or family member
                </Text>
              </View>
              <Feather
                name={guestExpanded ? "chevron-down" : "chevron-right"}
                size={20}
                color={guestExpanded ? NAVY : MUTED}
              />
            </Pressable>

            {guestExpanded ? (
              <View style={styles.guestBox}>
                <Text style={styles.guestLabel}>Their full name</Text>
                <TextInput
                  style={styles.guestInput}
                  placeholder="Mary Johnson"
                  placeholderTextColor={MUTED}
                  value={guestName}
                  onChangeText={setGuestName}
                  autoCapitalize="words"
                  editable={!guestSaving}
                />

                <Text style={styles.guestLabel}>Their phone</Text>
                <TextInput
                  style={styles.guestInput}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={MUTED}
                  value={guestPhone}
                  onChangeText={setGuestPhone}
                  keyboardType="phone-pad"
                  editable={!guestSaving}
                />

                <Text style={styles.guestLabel}>Their email</Text>
                <TextInput
                  style={styles.guestInput}
                  placeholder="janedoe@gmail.com"
                  placeholderTextColor={MUTED}
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!guestSaving}
                />
                <Text style={styles.guestHelper}>
                  Phone or email — at least one so we can text them ride
                  updates.
                </Text>

                <Pressable
                  onPress={() => setGuestConsent((c) => !c)}
                  style={({ pressed }) => [
                    styles.guestConsentRow,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View
                    style={[
                      styles.guestConsentBox,
                      guestConsent && styles.guestConsentBoxOn,
                    ]}
                  >
                    {guestConsent ? (
                      <Feather name="check" size={14} color={NAVY} />
                    ) : null}
                  </View>
                  <Text style={styles.guestConsentText}>
                    I have permission to book this ride and share their contact
                    info with the driver.
                  </Text>
                </Pressable>

                {guestError ? (
                  <Text style={styles.guestErrorText}>{guestError}</Text>
                ) : null}

                <Pressable
                  onPress={saveGuestAndContinue}
                  disabled={guestSaving}
                  style={({ pressed }) => [
                    styles.guestContinueBtn,
                    (guestSaving || pressed) && styles.pressed,
                  ]}
                >
                  {guestSaving ? (
                    <ActivityIndicator color={NAVY} />
                  ) : (
                    <Text style={styles.guestContinueText}>
                      Use this person
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {!showWhoPicker && !isSelf && activePerson && step !== 4 ? (
          <View style={styles.bookingForBanner}>
            <Feather
              name={bookingForGuest ? "user-plus" : "users"}
              size={14}
              color={TEAL}
            />
            <Text style={styles.bookingForText}>
              Booking for {activePerson.fullName}
            </Text>
          </View>
        ) : null}

        {!showWhoPicker ? (
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
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
              <View style={styles.dateRow}>
                <View style={[styles.dateField, { flex: 1 }]}>
                  <Text style={styles.dateFieldLabel}>Month</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="MM"
                    placeholderTextColor={MUTED}
                    value={dateMonth}
                    onChangeText={(v) => {
                      const clean = v.replace(/\D/g, "").slice(0, 2);
                      setDateMonth(clean);
                      if (clean.length === 2) dateDayRef.current?.focus();
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.dateField, { flex: 1 }]}>
                  <Text style={styles.dateFieldLabel}>Day</Text>
                  <TextInput
                    ref={dateDayRef}
                    style={styles.dateInput}
                    placeholder="DD"
                    placeholderTextColor={MUTED}
                    value={dateDay}
                    onChangeText={(v) => {
                      const clean = v.replace(/\D/g, "").slice(0, 2);
                      setDateDay(clean);
                      if (clean.length === 2) dateYearRef.current?.focus();
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.dateField, { flex: 1.4 }]}>
                  <Text style={styles.dateFieldLabel}>Year</Text>
                  <TextInput
                    ref={dateYearRef}
                    style={styles.dateInput}
                    placeholder="YYYY"
                    placeholderTextColor={MUTED}
                    value={dateYear}
                    onChangeText={(v) => {
                      const clean = v.replace(/\D/g, "").slice(0, 4);
                      setDateYear(clean);
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="done"
                  />
                </View>
              </View>
              {surgeryDate ? (
                <Text style={styles.dateHelper}>{formatDate(surgeryDate)}</Text>
              ) : null}

              <Text style={styles.label}>
                Surgery time<Required />
              </Text>
              <View style={styles.dateRow}>
                <View style={[styles.dateField, { flex: 1 }]}>
                  <Text style={styles.dateFieldLabel}>Hour</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="9"
                    placeholderTextColor={MUTED}
                    value={timeHour}
                    onChangeText={(v) => {
                      const clean = v.replace(/\D/g, "").slice(0, 2);
                      setTimeHour(clean);
                      if (clean.length === 2) timeMinRef.current?.focus();
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.dateField, { flex: 1 }]}>
                  <Text style={styles.dateFieldLabel}>Minute</Text>
                  <TextInput
                    ref={timeMinRef}
                    style={styles.dateInput}
                    placeholder="30"
                    placeholderTextColor={MUTED}
                    value={timeMinute}
                    onChangeText={(v) => {
                      const clean = v.replace(/\D/g, "").slice(0, 2);
                      setTimeMinute(clean);
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="done"
                  />
                </View>
                <View style={[styles.dateField, { flex: 1.4 }]}>
                  <Text style={styles.dateFieldLabel}>AM / PM</Text>
                  <View style={styles.ampmRow}>
                    {(["AM", "PM"] as const).map((v) => {
                      const active = timeAmPm === v;
                      return (
                        <Pressable
                          key={v}
                          onPress={() => setTimeAmPm(v)}
                          style={[
                            styles.ampmBtn,
                            active && styles.ampmBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.ampmText,
                              active && styles.ampmTextActive,
                            ]}
                          >
                            {v}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
              {surgeryTime ? (
                <Text style={styles.dateHelper}>{formatTime(surgeryTime)}</Text>
              ) : null}

              <Text style={styles.label}>
                Facility type<Required />
              </Text>
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

              <Text style={styles.label}>
                Procedure / visit type<Required />
              </Text>
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
    paddingTop: Platform.OS === "ios" ? 24 : 16,
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
  dateRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateField: {
    gap: 4,
  },
  dateFieldLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  },
  dateInput: {
    backgroundColor: CARD,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  dateHelper: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  ampmRow: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    overflow: "hidden",
  },
  ampmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ampmBtnActive: {
    backgroundColor: TEAL,
  },
  ampmText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  ampmTextActive: {
    color: NAVY,
  },
  guestBox: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  guestLabel: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    marginTop: 12,
  },
  guestInput: {
    backgroundColor: WHITE,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  guestHelper: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
  },
  guestConsentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    padding: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
  },
  guestConsentBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  guestConsentBoxOn: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  guestConsentText: {
    flex: 1,
    color: NAVY,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  guestErrorText: {
    color: ERROR,
    fontSize: 13,
    marginTop: 12,
    fontFamily: "Inter_500Medium",
  },
  guestContinueBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  guestContinueText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
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
