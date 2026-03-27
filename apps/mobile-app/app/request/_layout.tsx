import React from 'react';
import { Stack } from 'expo-router';

export default function RequestLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="location" />
      <Stack.Screen name="details" />
      <Stack.Screen name="confirm" />
    </Stack>
  );
}
