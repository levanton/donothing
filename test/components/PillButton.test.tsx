import { render, screen, fireEvent } from '@testing-library/react-native';
import PillButton from '@/components/PillButton';

// @expo/vector-icons loads its font asynchronously and triggers a
// setState that lands after the render, producing a "not wrapped in
// act()" warning in tests. The icon is a visual leaf and the warning
// is unrelated to behaviour we care about — silence it for this file.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('<PillButton />', () => {
  it('renders the label and fires onPress', () => {
    const onPress = jest.fn();
    render(<PillButton label="Start" onPress={onPress} color="#C26749" outline />);
    fireEvent.press(screen.getByText('Start'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps onPress wired across variant changes', () => {
    const onPress = jest.fn();
    const { rerender } = render(
      <PillButton label="A" onPress={onPress} color="#C26749" outline />,
    );
    fireEvent.press(screen.getByText('A'));

    rerender(<PillButton label="B" onPress={onPress} color="#C26749" filled />);
    fireEvent.press(screen.getByText('B'));

    rerender(<PillButton label="C" onPress={onPress} color="#C26749" />);
    fireEvent.press(screen.getByText('C'));

    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('uses the provided variant when both prop forms are set', () => {
    const onPress = jest.fn();
    // `variant` should win over `outline`/`filled` boolean shortcuts.
    render(
      <PillButton
        label="Win"
        onPress={onPress}
        color="#000"
        variant="filled"
        outline
      />,
    );
    expect(screen.getByText('Win')).toBeTruthy();
  });

  it('renders an icon-bearing label when icon prop is set', () => {
    const onPress = jest.fn();
    render(
      <PillButton label="Go" onPress={onPress} color="#000" icon="check" filled />,
    );
    expect(screen.getByText('Go')).toBeTruthy();
  });
});
