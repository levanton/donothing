import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * React's dev-mode error boundary path logs to console.error. Silence
 * it so test output isn't polluted with stack traces from the
 * intentionally-thrown error fixtures.
 */
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

function Boom({ message = 'kaboom' }: { message?: string }): ReactElement {
  throw new Error(message);
}

describe('<ErrorBoundary />', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Text>healthy</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeTruthy();
  });

  it('renders the fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('SOMETHING BROKE')).toBeTruthy();
    expect(screen.getByText('The app hit an unexpected error.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('calls onError with the captured error', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom message="specific-failure" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [err] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('specific-failure');
  });

  it('resets and re-renders children when "Try again" is pressed', () => {
    // First render: a child that throws. After reset, the boundary
    // re-renders children — we use a stateful holder via re-render
    // to swap from broken to healthy and ensure the boundary clears.
    const { rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('SOMETHING BROKE')).toBeTruthy();

    // Swap in a healthy child, then tap the reset button.
    rerender(
      <ErrorBoundary>
        <Text>recovered</Text>
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText('Try again'));

    // After reset, healthy children render normally.
    expect(screen.getByText('recovered')).toBeTruthy();
    expect(screen.queryByText('SOMETHING BROKE')).toBeNull();
  });

  it('shows the error message in dev mode only', () => {
    render(
      <ErrorBoundary>
        <Boom message="dev-detail-shows" />
      </ErrorBoundary>,
    );
    // __DEV__ is true in the test harness, so the detail line renders.
    expect(screen.getByText(/dev-detail-shows/)).toBeTruthy();
  });
});
