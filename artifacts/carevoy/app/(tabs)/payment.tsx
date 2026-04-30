import { Feather, FontAwesome } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { Required } from "../../components/Required";
import {
  createSetupSession,
  detachPaymentMethod,
  getReturnUrl,
  listPaymentMethods,
  type SavedPaymentMethod,
} from "../../lib/paymentsApi";
import { supabase } from "../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GREEN = "#22C55E";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

function brandLabel(brand: string): string {
  const b = (brand || "").toLowerCase();
  if (b === "visa") return "Visa";
  if (b === "mastercard") return "Mastercard";
  if (b === "amex" || b === "american_express") return "Amex";
  if (b === "discover") return "Discover";
  if (b === "diners") return "Diners";
  if (b === "jcb") return "JCB";
  if (b === "unionpay") return "UnionPay";
  return "Card";
}

export default function PaymentScreen() {
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [hasCustomer, setHasCustomer] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);

  const [autoEmail, setAutoEmail] = useState(true);
  const [email, setEmail] = useState("");

  const [adding, setAdding] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    setPatientId(userId);
    const { data } = await supabase
      .from("patients")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (data?.email) setEmail(data.email);
    setHasCustomer(!!data?.stripe_customer_id?.startsWith("cus_"));
    // Methods are fetched server-side, scoped to the authenticated user.
    const list = await listPaymentMethods();
    setMethods(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Web: when Stripe redirects back here with ?stripe_status=success|cancel,
  // surface the result and clean the URL.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("stripe_status");
    if (!status) return;
    if (status === "success") {
      setSuccess("Payment method saved.");
    } else if (status === "cancel") {
      setError("No changes were made.");
    }
    params.delete("stripe_status");
    const next = `${window.location.pathname}${
      params.toString() ? "?" + params.toString() : ""
    }`;
    window.history.replaceState({}, "", next);
    void load();
  }, [load]);

  const onAddPaymentMethod = async () => {
    setError(null);
    setSuccess(null);

    if (!patientId) {
      setError("Please sign in first.");
      return;
    }

    setAdding(true);
    try {
      const { url } = await createSetupSession({
        email: email.trim() || undefined,
        returnUrl: getReturnUrl(),
      });

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle:
            WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          dismissButtonStyle: "done",
        });
        // Refresh from Stripe — the actual saved cards are the source of truth.
        await load();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not start Stripe checkout. ${msg}`);
    } finally {
      setAdding(false);
    }
  };

  // Suppress unused-var warning while we keep this state for future surfacing.
  void hasCustomer;

  const onRemoveMethod = async (id: string, label: string) => {
    const confirm = async () => {
      const ok = await detachPaymentMethod(id);
      if (ok) {
        setMethods((m) => m.filter((x) => x.id !== id));
        setSuccess("Payment method removed.");
      } else {
        setError("Could not remove that card. Please try again.");
      }
    };
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm(`Remove ${label}?`)) {
        confirm();
      }
      return;
    }
    Alert.alert(
      "Remove payment method",
      `Are you sure you want to remove ${label}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: confirm },
      ],
    );
  };

  const onSaveEmail = async () => {
    setError(null);
    setSuccess(null);
    if (autoEmail && !email.trim()) {
      setError("Add an email to receive receipts, or turn off auto-email.");
      return;
    }
    if (!patientId) {
      setError("Not signed in.");
      return;
    }
    setSavingEmail(true);
    const { error: upErr } = await supabase
      .from("patients")
      .update({ email: email.trim() || null })
      .eq("id", patientId);
    setSavingEmail(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setSuccess("Receipt email saved.");
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
            Your ride is a tax-free medical expense under IRS Code 213(d). Add
            an HSA, FSA, or any debit/credit card — Apple Pay and Google Pay
            also work.
          </Text>

          {/* HSA / FSA INFO CARD */}
          <View style={styles.hsaCard}>
            <View style={styles.hsaHeader}>
              <View style={styles.hsaLabelWrap}>
                <Feather name="credit-card" size={20} color={NAVY} />
                <Text style={styles.hsaLabel}>HSA / FSA Eligible</Text>
              </View>
              <View style={styles.taxBadge}>
                <Text style={styles.taxBadgeText}>TAX-FREE ✓</Text>
              </View>
            </View>
            <Text style={styles.hsaHelper}>
              Add your HSA or FSA debit card the same way you&apos;d add any
              other card. CareVoy auto-generates an IRS-compliant receipt
              (IRS Code 213(d)) after every ride.
            </Text>
          </View>

          {/* SAVED METHODS */}
          <Text style={styles.sectionLabel}>Saved payment methods</Text>
          {methods.length === 0 ? (
            <View style={styles.emptyMethodsCard}>
              <Feather name="credit-card" size={20} color={MUTED} />
              <Text style={styles.emptyMethodsText}>
                No cards on file yet. Add one below to be ready for your next
                ride.
              </Text>
            </View>
          ) : (
            methods.map((m) => {
              const label = `${brandLabel(m.brand)} •••• ${m.last4}`;
              return (
                <View key={m.id} style={styles.methodRow}>
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIcon}>
                      <Feather name="credit-card" size={18} color={NAVY} />
                    </View>
                    <View>
                      <Text style={styles.methodTitle}>{label}</Text>
                      {m.expMonth && m.expYear ? (
                        <Text style={styles.methodSub}>
                          Expires {String(m.expMonth).padStart(2, "0")}/
                          {String(m.expYear).slice(-2)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => onRemoveMethod(m.id, label)}
                    accessibilityLabel={`Remove ${label}`}
                    style={({ pressed }) => [
                      styles.methodRemove,
                      pressed && styles.pressed,
                    ]}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={16} color={ERROR} />
                  </Pressable>
                </View>
              );
            })
          )}

          {/* ADD METHOD CTA */}
          <Pressable
            onPress={onAddPaymentMethod}
            disabled={adding}
            accessibilityLabel="Add a payment method via Stripe"
            style={({ pressed }) => [
              styles.addBtn,
              (pressed || adding) && styles.pressed,
            ]}
          >
            {adding ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <Feather name="plus-circle" size={18} color={NAVY} />
                <Text style={styles.addBtnText}>
                  {methods.length === 0
                    ? "Add a payment method"
                    : "Add another payment method"}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.walletHintRow}>
            <View style={styles.walletChip}>
              <FontAwesome name="apple" size={14} color={NAVY} />
              <Text style={styles.walletChipText}>Apple Pay</Text>
            </View>
            <View style={styles.walletChip}>
              <Text style={styles.gPayG}>G</Text>
              <Text style={styles.walletChipText}>Google Pay</Text>
            </View>
            <View style={styles.walletChip}>
              <Feather name="credit-card" size={14} color={NAVY} />
              <Text style={styles.walletChipText}>Card</Text>
            </View>
          </View>
          <Text style={styles.secureRow}>
            <Feather name="lock" size={11} color={MUTED} /> Secured by Stripe.
            Your card details never touch CareVoy&apos;s servers.
          </Text>

          {/* SECTION 4 — Receipts */}
          <Text style={styles.sectionLabel}>Receipts &amp; reimbursement</Text>
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

            <Text style={styles.fieldLabel}>
              Receipt email<Required />
            </Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
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
              (savingEmail || pressed) && styles.pressed,
            ]}
            onPress={onSaveEmail}
            disabled={savingEmail}
          >
            {savingEmail ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.saveBtnText}>Save Receipt Email</Text>
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
  hsaHelper: {
    color: NAVY,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },

  sectionLabel: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginTop: 28,
    marginBottom: 10,
  },

  emptyMethodsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyMethodsText: {
    flex: 1,
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },

  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  methodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  methodSub: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  methodRemove: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  addBtnText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  walletHintRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    justifyContent: "center",
  },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  walletChipText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  gPayG: {
    color: "#4285F4",
    fontWeight: "700",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  secureRow: {
    color: MUTED,
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    fontFamily: "Inter_400Regular",
  },

  fieldLabel: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 11,
    color: NAVY,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },

  receiptCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
  },
  toggleTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  toggleSub: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },

  error: {
    color: ERROR,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  successText: {
    color: NAVY,
    fontSize: 13,
    flex: 1,
    fontFamily: "Inter_500Medium",
  },

  footer: {
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    padding: 16,
  },
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
