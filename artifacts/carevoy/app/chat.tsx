import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
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

import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GREEN = "#22C55E";
const WHITE = "#FFFFFF";
const MUTED = "#8A93A6";
const AI_BUBBLE = "#0A1628";
const BORDER = "#1B2A4A";
const ERROR = "#FF6B6B";

type Role = "user" | "assistant";
type Msg = {
  id: string;
  role: Role;
  content: string;
  ts: Date;
  extraction?: BookRideExtraction | null;
};

type BookRideExtraction = {
  intent: "book_ride";
  surgery_date?: string;
  surgery_time?: string;
  hospital_name?: string;
  procedure_type?: string;
  needs_wheelchair?: boolean;
  needs_companion?: boolean;
  special_instructions?: string;
};

const QUICK_REPLIES = [
  "Book a ride",
  "HSA/FSA question",
  "My upcoming rides",
  "Get my receipt",
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getApiBase(): string {
  const domain =
    process.env.EXPO_PUBLIC_DOMAIN ?? process.env.EXPO_PUBLIC_API_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("there");
  const conversationIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // typing indicator dot animations
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!sending) return;
    const animate = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 120);
    const a3 = animate(dot3, 240);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [sending, dot1, dot2, dot3]);

  // initial load: fetch user profile, create conversation, send greeting
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      userIdRef.current = userId;

      const { data: patient } = await supabase
        .from("patients")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const fn = patient?.full_name?.trim().split(/\s+/)[0] ?? "there";
      setFirstName(fn);

      // create a new conversation
      const { data: convo } = await supabase
        .from("ai_conversations")
        .insert({ patient_id: userId, title: "Care Coordinator" })
        .select("id")
        .maybeSingle();
      if (convo?.id) conversationIdRef.current = convo.id;

      const greeting: Msg = {
        id: `g_${Date.now()}`,
        role: "assistant",
        content: `Hi ${fn}! I'm your CareVoy care coordinator. I can help you book a ride, answer HSA/FSA questions, check on your upcoming rides, or anything else related to your medical transportation. What can I help you with today?`,
        ts: new Date(),
      };
      setMessages([greeting]);

      if (convo?.id) {
        await supabase.from("ai_messages").insert({
          conversation_id: convo.id,
          role: "assistant",
          content: greeting.content,
        });
      }
    })();
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    const userMsg: Msg = {
      id: `u_${Date.now()}`,
      role: "user",
      content: trimmed,
      ts: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    if (conversationIdRef.current) {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationIdRef.current,
        role: "user",
        content: trimmed,
      });
    }

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const base = getApiBase();
      const res = await fetch(`${base}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          patientFirstName: firstName,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as {
        content: string;
        extraction: BookRideExtraction | null;
      };

      const aiMsg: Msg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.content || "(no response)",
        ts: new Date(),
        extraction: data.extraction ?? null,
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (conversationIdRef.current) {
        await supabase.from("ai_messages").insert({
          conversation_id: conversationIdRef.current,
          role: "assistant",
          content: aiMsg.content,
        });

        if (data.extraction) {
          await supabase.from("ai_extractions").insert({
            conversation_id: conversationIdRef.current,
            patient_id: userIdRef.current,
            intent: data.extraction.intent,
            extracted_data: data.extraction,
          });
        }
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to reach coordinator";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages, sending]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="chevron-left" size={26} color={WHITE} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.topTitle}>Care Coordinator</Text>
            <View style={styles.subRow}>
              <Text style={styles.subText}>Powered by CareVoy AI</Text>
              <Text style={styles.subDivider}>•</Text>
              <View style={styles.dot} />
              <Text style={styles.online}>Online</Text>
            </View>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <View key={m.id} style={{ width: "100%" }}>
              <View
                style={[
                  styles.bubbleRow,
                  m.role === "user" ? styles.rowRight : styles.rowLeft,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    m.role === "user" ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      m.role === "user" && styles.userText,
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.ts,
                  m.role === "user" ? styles.tsRight : styles.tsLeft,
                ]}
              >
                {formatTime(m.ts)}
              </Text>

              {m.extraction && (
                <BookingCard
                  data={m.extraction}
                  onConfirm={() =>
                    router.push({
                      pathname: "/book-ride",
                      params: { prefill: JSON.stringify(m.extraction) },
                    })
                  }
                />
              )}
            </View>
          ))}

          {sending && (
            <View style={[styles.bubbleRow, styles.rowLeft]}>
              <View
                style={[styles.bubble, styles.aiBubble, styles.typingBubble]}
              >
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: dot1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          translateY: dot1.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: dot2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          translateY: dot2.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: dot3.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          translateY: dot3.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.composer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {QUICK_REPLIES.map((q) => (
              <Pressable
                key={q}
                style={styles.chip}
                onPress={() => send(q)}
                disabled={sending}
              >
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message your coordinator…"
              placeholderTextColor={MUTED}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              multiline
            />
            <Pressable
              style={[
                styles.sendBtn,
                (!input.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
            >
              <Feather name="arrow-up" size={20} color={NAVY} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BookingCard({
  data,
  onConfirm,
}: {
  data: BookRideExtraction;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.bookCard}>
      <View style={styles.bookHeader}>
        <Feather name="calendar" size={16} color={TEAL} />
        <Text style={styles.bookTitle}>Booking summary</Text>
      </View>
      {data.surgery_date ? (
        <Row
          label="Date"
          value={`${data.surgery_date} ${data.surgery_time ?? ""}`.trim()}
        />
      ) : null}
      {data.hospital_name ? (
        <Row label="Hospital" value={data.hospital_name} />
      ) : null}
      {data.procedure_type ? (
        <Row label="Procedure" value={data.procedure_type} />
      ) : null}
      {data.needs_wheelchair ? (
        <Row label="Mobility" value="Wheelchair vehicle" />
      ) : null}
      {data.needs_companion ? <Row label="Companion" value="Yes" /> : null}
      {data.special_instructions ? (
        <Row label="Notes" value={data.special_instructions} />
      ) : null}
      <Pressable style={styles.bookBtn} onPress={onConfirm}>
        <Text style={styles.bookBtnText}>Confirm in booking flow</Text>
        <Feather name="arrow-right" size={16} color={NAVY} />
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bookRow}>
      <Text style={styles.bookLabel}>{label}</Text>
      <Text style={styles.bookValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  topTitle: {
    color: WHITE,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  subText: {
    color: MUTED,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  subDivider: { color: MUTED, fontSize: 11 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  online: {
    color: GREEN,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },

  thread: { padding: 16, paddingBottom: 20 },
  bubbleRow: { flexDirection: "row", marginBottom: 4 },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: TEAL,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: AI_BUBBLE,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  bubbleText: {
    color: WHITE,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  userText: { color: NAVY, fontWeight: "500", fontFamily: "Inter_500Medium" },
  ts: {
    color: MUTED,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
  },
  tsLeft: { textAlign: "left", marginLeft: 8 },
  tsRight: { textAlign: "right", marginRight: 8 },

  typingBubble: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MUTED,
  },

  bookCard: {
    backgroundColor: AI_BUBBLE,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: TEAL,
  },
  bookHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  bookTitle: {
    color: TEAL,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  bookRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 12,
  },
  bookLabel: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    width: 90,
  },
  bookValue: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
  bookBtn: {
    marginTop: 12,
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bookBtnText: {
    color: NAVY,
    fontWeight: "700",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  composer: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: NAVY,
  },
  chips: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: AI_BUBBLE,
    marginRight: 8,
  },
  chipText: {
    color: WHITE,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: AI_BUBBLE,
    borderWidth: 1,
    borderColor: BORDER,
    color: WHITE,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
    maxHeight: 120,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  error: {
    color: ERROR,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    fontFamily: "Inter_500Medium",
  },
});
