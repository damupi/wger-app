import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#1a1a1a', borderTopColor: '#333' },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#666',
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="history" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="start-workout"
        options={{
          title: 'Workout',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="fitness-center" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="menu-book" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
