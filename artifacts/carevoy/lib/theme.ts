export const colors = {
  bg: "#FFFFFF",
  text: "#050D1F",
  textMuted: "#6B7280",
  textOnPrimary: "#050D1F",
  primary: "#00C2A8",
  accent: "#F5A623",
  card: "#F8FAFC",
  cardElev: "#FFFFFF",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  active: "#00C2A8",
  success: "#22C55E",
  warning: "#F5A623",
  danger: "#EF4444",
  overlay: "rgba(15, 23, 42, 0.45)",
} as const;

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  button: {
    shadowColor: "#00C2A8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;
