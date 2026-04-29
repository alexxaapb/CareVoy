import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "./supabase";

const STORAGE_KEY = "carevoy.activePatientId";

export type CarePerson = {
  patientId: string;
  fullName: string;
  isSelf: boolean;
  relationship?: string | null;
};

type CareContextValue = {
  loading: boolean;
  selfPatientId: string | null;
  selfFullName: string | null;
  careRecipients: CarePerson[];
  activePerson: CarePerson | null;
  setActivePersonById: (patientId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CareContext = createContext<CareContextValue>({
  loading: true,
  selfPatientId: null,
  selfFullName: null,
  careRecipients: [],
  activePerson: null,
  setActivePersonById: async () => {},
  refresh: async () => {},
});

export function CareProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [selfPatientId, setSelfPatientId] = useState<string | null>(null);
  const [selfFullName, setSelfFullName] = useState<string | null>(null);
  const [careRecipients, setCareRecipients] = useState<CarePerson[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    if (!userId) {
      setSelfPatientId(null);
      setSelfFullName(null);
      setCareRecipients([]);
      setActivePatientId(null);
      setLoading(false);
      return;
    }
    setSelfPatientId(userId);

    const [selfRes, careRes] = await Promise.all([
      supabase
        .from("patients")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("caregivers")
        .select("patient_id, relationship, patients!inner(full_name)")
        .eq("caregiver_user_id", userId)
        .eq("active", true),
    ]);
    const selfName = selfRes.data?.full_name ?? null;
    setSelfFullName(selfName);

    type CareRow = {
      patient_id: string;
      relationship: string | null;
      patients: { full_name: string | null } | null;
    };
    const list: CarePerson[] =
      ((careRes.data as unknown as CareRow[]) ?? []).map((r) => ({
        patientId: r.patient_id,
        fullName: r.patients?.full_name ?? "Care recipient",
        relationship: r.relationship,
        isSelf: false,
      }));
    setCareRecipients(list);

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const validIds = new Set<string>([userId, ...list.map((c) => c.patientId)]);
    if (stored && validIds.has(stored)) {
      setActivePatientId(stored);
    } else {
      setActivePatientId(userId);
      await AsyncStorage.setItem(STORAGE_KEY, userId);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const setActivePersonById = useCallback(async (patientId: string) => {
    setActivePatientId(patientId);
    await AsyncStorage.setItem(STORAGE_KEY, patientId);
  }, []);

  const activePerson = useMemo<CarePerson | null>(() => {
    if (!activePatientId) return null;
    if (activePatientId === selfPatientId) {
      return {
        patientId: activePatientId,
        fullName: selfFullName ?? "You",
        isSelf: true,
      };
    }
    return careRecipients.find((c) => c.patientId === activePatientId) ?? null;
  }, [activePatientId, selfPatientId, selfFullName, careRecipients]);

  const value: CareContextValue = {
    loading,
    selfPatientId,
    selfFullName,
    careRecipients,
    activePerson,
    setActivePersonById,
    refresh,
  };

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  return useContext(CareContext);
}
