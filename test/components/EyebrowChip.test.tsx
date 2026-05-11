import { render, screen } from '@testing-library/react-native';
import EyebrowChip from '@/components/EyebrowChip';

describe('<EyebrowChip />', () => {
  it('renders the text exactly as provided', () => {
    render(<EyebrowChip text="YOUR APPS ARE LOCKED" />);
    expect(screen.getByText('YOUR APPS ARE LOCKED')).toBeTruthy();
  });

  it('renders a second variant without crashing', () => {
    render(<EyebrowChip text="PAUSED" bg="#fff" color="#000" />);
    expect(screen.getByText('PAUSED')).toBeTruthy();
  });
});
