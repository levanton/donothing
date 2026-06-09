import type { ReactNode } from 'react';
import { View } from 'react-native';

interface Props {
  locked: boolean;
  children: ReactNode;
}

/**
 * Makes premium content non-interactive while locked, with no visual overlay
 * of its own — screens hide the actual data themselves (e.g. masking the stat
 * numbers) so the layout stays clean. The membership banner is the CTA.
 */
export default function LockedRegion({ locked, children }: Props) {
  return <View pointerEvents={locked ? 'none' : 'auto'}>{children}</View>;
}
