export const isDemoMode = (): boolean => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location?.search || "");
    return params.get("demo") === "1";
  }
  return false;
};
