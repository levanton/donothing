import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { getStepDef } from '@/lib/tutorial/steps';

// CopilotStep needs a single child that can hold a ref + measure itself.
// Children of the donothing UI (Pressable in expo-router, BottomSheet
// internals, ActivityCalendar) don't all forward refs cleanly, so we
// wrap them in a measurable View. Use this anywhere we want to spotlight
// an element — the styling is transparent so layout stays untouched.

const WalkthroughableView = walkthroughable(View);

interface Props {
  name: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function TutorialStepWrapper({ name, children, style }: Props) {
  const def = getStepDef(name);
  if (!def) {
    if (__DEV__) console.warn(`[tutorial] unknown step name: ${name}`);
    return <>{children}</>;
  }
  return (
    <CopilotStep name={def.name} order={def.order} text={def.text}>
      <WalkthroughableView style={style} collapsable={false}>
        {children}
      </WalkthroughableView>
    </CopilotStep>
  );
}
