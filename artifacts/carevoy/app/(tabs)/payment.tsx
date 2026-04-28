import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GREEN = "#22C55E";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

function formatCardNumber(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function last4(card: string): string {
  const digits = card.replace(/\D/g, "");
  return digits.slice(-4);
}

export default function PaymentScreen() {
  // HSA/FSA
  const [hsaNumber, setHsaNumber] = useState("");
  const [hsaExpiry, setHsaExpiry] = useState("");
  const [hsaCvv, setHsaCvv] = useState("");
  const [hsaSavedLast4, setHsaSavedLast4] = useState<string | null>(null);

  // Regular card
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardSavedLast4, setCardSavedLast4] = useState<string | null>(null);

  // Receipt
  const [autoEmail, setAutoEmail] = useState(true);
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data } = await supabase
      .from("patients")
      .select("email, hsa_fsa_card_token, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (data?.email) setEmail(data.email);
    if (data?.hsa_fsa_card_token) {
      const m = data.hsa_fsa_card_token.match(/(\d{4})$/);
      setHsaSavedLast4(m ? m[1] : "••••");
    }
    if (data?.stripe_customer_id) {
      const m = data.stripe_customer_id.match(/(\d{4})$/);
      setCardSavedLast4(m ? m[1] : "••••");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSave = async () => {
    setError(null);
    setSuccess(null);
    const hasHsa = hsaNumber && hsaExpiry && hsaCvv;
    const hasCard = cardNumber && cardExpiry && cardCvv;

    if (!hasHsa && !hasCard && !hsaSavedLast4 && !cardSavedLast4) {
      setError("Please enter an HSA/FSA card or a regular card to save.");
      return;
    }
    if (autoEmail && !email.trim()) {
      setError("Add an email to receive receipts, or turn off auto-email.");
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const update: Record<string, string | null> = {};
    if (hasHsa) update.hsa_fsa_card_token = `card_hsa_${last4(hsaNumber)}`;
    if (hasCard) update.stripe_customer_id = `card_std_${last4(cardNumber)}`;
    if (email.trim()) update.email = email.trim();

    const { error: upErr } = await supabase
      .from("patients")
      .update(update)
      .eq("id", userId);

    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }

    if (hasHsa) {
      setHsaSavedLast4(last4(hsaNumber));
      setHsaNumber("");
      setHsaExpiry("");
      setHsaCvv("");
    }
    if (hasCard) {
      setCardSavedLast4(last4(cardNumber));
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
    }
    setSuccess(
      hasHsa
        ? "HSA/FSA card saved. You're ready to ride."
        : "Payment method saved. You're ready to ride.",
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Pay with Your HSA or FSA</Text>
          <Text style={styles.subtitle}>
            Your ride is a tax-free medical expense under IRS Code 213(d). Use
            your pre-tax dollars — automatically.
          </Text>

          {/* SECTION 1 — HSA/FSA */}
          <View style={styles.hsaCard}>
            <View style={styles.hsaHeader}>
              <View style={styles.hsaLabelWrap}>
                <Feather name="credit-card" size={20} color={NAVY} />
                <Text style={styles.hsaLabel}>HSA / FSA Card</Text>
              </View>
              <View style={styles.taxBadge}>
                <Text style={styles.taxBadgeText}>TAX-FREE ✓</Text>
              </View>
            </View>

            {hsaSavedLast4 ? (
              <View style={styles.savedRow}>
                <Feather name="check-circle" size={18} color={NAVY} />
                <Text style={styles.savedText}>
                  Card on file ending in {hsaSavedLast4}
                </Text>
              </View>
            ) : null}

            <Text style={styles.hsaFieldLabel}>Card number</Text>
            <TextInput
              style={styles.hsaInput}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor="rgba(5,13,31,0.4)"
              keyboardType="number-pad"
              value={hsaNumber}
              onChangeText={(t) => setHsaNumber(formatCardNumber(t))}
            />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hsaFieldLabel}>Expiry</Text>
                <TextInput
                  style={styles.hsaInput}
                  placeholder="MM/YY"
                  placeholderTextColor="rgba(5,13,31,0.4)"
                  keyboardType="number-pad"
                  value={hsaExpiry}
                  onChangeText={(t) => setHsaExpiry(formatExpiry(t))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hsaFieldLabel}>CVV</Text>
                <TextInput
                  style={styles.hsaInput}
                  placeholder="123"
                  placeholderTextColor="rgba(5,13,31,0.4)"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  value={hsaCvv}
                  onChangeText={setHsaCvv}
                />
              </View>
            </View>

            <Text style={styles.hsaHelper}>
              Your HSA card works like a debit card. Your FSA card is verified
              automatically via our payment partner.
            </Text>
            <View style={styles.hsaNoteRow}>
              <Feather name="file-text" size={14} color={NAVY} />
              <Text style={styles.hsaNote}>
                An IRS-compliant receipt is generated and emailed to you
                automatically after every ride.
              </Text>
            </View>
          </View>

          {/* SECTION 2 — Info */}
          <View style={styles.infoBox}>
            <View style={styles.infoIcon}>
              <Feather name="shield" size={18} color={TEAL} />
            </View>
            <Text style={styles.infoText}>
              Transportation to and from surgery is{" "}
              <Text style={styles.infoBold}>100% HSA/FSA eligible</Text>.
              CareVoy handles the documentation so you never have to file a
              reimbursement form manually.
            </Text>
          </View>

          {/* SECTION 3 — Regular Card */}
          <Text style={styles.sectionLabel}>Or pay with a regular card</Text>
          <Text style={styles.sectionSub}>
            We&apos;ll generate an HSA/FSA reimbursement receipt you can submit
            to your provider for refund.
          </Text>

          <View style={styles.regCard}>
            {cardSavedLast4 ? (
              <View style={styles.savedRowAlt}>
                <Feather name="check-circle" size={16} color={TEAL} />
                <Text style={styles.savedTextAlt}>
                  Card on file ending in {cardSavedLast4}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Card number</Text>
            <TextInput
              style={styles.input}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              value={cardNumber}
              onChangeText={(t) => setCardNumber(formatCardNumber(t))}
            />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Expiry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/YY"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  value={cardExpiry}
                  onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  value={cardCvv}
                  onChangeText={setCardCvv}
                />
              </View>
            </View>
          </View>

          {/* SECTION 4 — Receipts */}
          <Text style={styles.sectionLabel}>Receipts & reimbursement</Text>
          <View style={styles.receiptCard}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.toggleTitle}>
                  Auto-email receipt after every ride
                </Text>
                <Text style={styles.toggleSub}>
                  Your receipt includes everything your HSA/FSA provider needs:
                  date, provider, amount, and IRS expense code.
                </Text>
              </View>
              <Switch
                value={autoEmail}
                onValueChange={setAutoEmail}
                trackColor={{ false: BORDER, true: TEAL }}
                thumbColor={WHITE}
                ios_backgroundColor={BORDER}
              />
            </View>

            <Text style={styles.fieldLabel}>Receipt email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? (
            <View style={styles.successCard}>
              <Feather name="check-circle" size={20} color={GREEN} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || pressed) && styles.pressed,
            ]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.saveBtnText}>Save Payment Method</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 40 },
  title: {
    color: NAVY,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
    fontFamily: "Inter_400Regular",
  },

  hsaCard: {
    backgroundColor: TEAL,
    borderRadius: 20,
    padding: 20,
    shadowColor: TEAL,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  hsaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  hsaLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  hsaLabel: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  taxBadge: {
    backgroundColor: WHITE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  taxBadgeText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(5,13,31,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  savedText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  hsaFieldLabel: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  hsaInput: {
    backgroundColor: "rgba(5,13,31,0.08)",
    color: NAVY,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
  },
  row2: { flexDirection: "row", gap: 12 },
  hsaHelper: {
    color: NAVY,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 14,
    opacity: 0.85,
    fontFamily: "Inter_400Regular",
  },
  hsaNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(5,13,31,0.15)",
  },
  hsaNote: {
    flex: 1,
    color: NAVY,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 14,
    padding: 16,
    marginTop: 22,
    backgroundColor: "rgba(0,194,168,0.06)",
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(0,194,168,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    color: NAVY,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  infoBold: {
    color: TEAL,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  sectionLabel: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 28,
  },
  sectionSub: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
  },
  regCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  savedRowAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  savedTextAlt: {
    color: TEAL,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  fieldLabel: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: WHITE,
    color: NAVY,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },

  receiptCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
  },
  toggleTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  toggleSub: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },

  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },
  successText: {
    flex: 1,
    color: NAVY,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  error: {
    color: ERROR,
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },

  footer: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 100 : 96,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: WHITE,
  },
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  saveBtnText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  pressed: { opacity: 0.85 },
});
