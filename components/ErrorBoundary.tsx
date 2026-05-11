import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { APP_BG, palette } from '@/lib/theme';

interface Props {
  children: ReactNode;
  /**
   * Hook for sending the error to a crash reporter (Sentry, etc.).
   * Keep the boundary itself transport-agnostic so the wiring stays in
   * one place — usually app/_layout.tsx.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary. Catches render-time exceptions that
 * would otherwise blank the app (`Element type is invalid`, accessing
 * undefined fields, etc.) and shows a recoverable fallback.
 *
 * Async errors (Promise rejections, event handlers) bypass error
 * boundaries — those need a global `ErrorUtils.setGlobalHandler` /
 * Sentry init for capture. This boundary covers the render path only.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Always log so the dev console catches it; the consumer can also
    // forward to Sentry via the onError prop.
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={[styles.eyebrow, { fontFamily: Fonts!.serif }]}>
            SOMETHING BROKE
          </Text>
          <Text style={styles.heading}>The app hit an unexpected error.</Text>
          <Text style={styles.body}>
            Try again. If it keeps happening, reopening the app usually clears
            it.
          </Text>
          {__DEV__ ? (
            <Text style={styles.devDetails} numberOfLines={6}>
              {this.state.error.message}
            </Text>
          ) : null}
          <Pressable onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: palette.terracotta,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: palette.terracotta,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 22,
    color: palette.brown,
    fontWeight: '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 15,
    color: palette.brown,
    lineHeight: 22,
  },
  devDetails: {
    fontSize: 12,
    color: palette.danger,
    marginTop: 4,
    fontFamily: 'Menlo',
  },
  button: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: palette.terracotta,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  buttonLabel: {
    color: palette.cream,
    fontSize: 16,
    fontWeight: '500',
  },
});
