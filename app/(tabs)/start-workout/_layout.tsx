import { Stack } from 'expo-router';

export default function StartWorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[routineId]" />
      <Stack.Screen name="workout" />
    </Stack>
  );
}
