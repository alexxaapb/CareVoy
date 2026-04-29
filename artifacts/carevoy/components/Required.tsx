import React from "react";
import { Text } from "react-native";

const ERROR = "#EF4444";

export function Required() {
  return (
    <Text accessibilityLabel="required" style={{ color: ERROR }}>
      {" "}*
    </Text>
  );
}
