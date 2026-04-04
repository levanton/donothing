import { Stack } from 'expo-router';
import { View } from 'react-native';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#444444' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#444444' } }}>
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}
