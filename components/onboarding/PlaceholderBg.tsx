import { StyleSheet, View } from 'react-native';

interface Props {
  colors: [string, string];
}

export default function PlaceholderBg({ colors }: Props) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors[1],
            opacity: 0.45,
            borderRadius: 999,
            transform: [{ scale: 1.8 }],
            top: '20%',
          },
        ]}
      />
    </View>
  );
}
