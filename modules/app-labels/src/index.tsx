import { requireNativeViewManager } from 'expo-modules-core';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import React from 'react';

export interface AppLabelsViewProps {
  /** familyActivitySelectionId stored by react-native-device-activity */
  activitySelectionId: string;
  /** Pixel size of each app icon. Default 32. */
  iconSize?: number;
  /** Cap shown icons. Remainder becomes a "+N" bubble. 0 = unlimited. */
  maxItems?: number;
  /** Positive pixel overlap between icons (avatar-stack effect). Default 0. */
  overlap?: number;
  /** Layout: "row" (HStack) or "grid" (adaptive VGrid). */
  layout?: 'row' | 'grid';
  /** Hex color (#RRGGBB or #RRGGBBAA) for category/generic glyph tint. */
  tintColor?: string;
  /** Hex color of the ring/backdrop behind each icon. Match card bg. */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

const NativeView: React.ComponentType<AppLabelsViewProps> | null =
  Platform.OS === 'ios'
    ? requireNativeViewManager('AppLabelsViewModule')
    : null;

export default function AppLabelsView(props: AppLabelsViewProps) {
  if (!NativeView) return null;
  return <NativeView {...props} />;
}
