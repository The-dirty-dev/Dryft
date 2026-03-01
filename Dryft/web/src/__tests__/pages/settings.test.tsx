import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

describe('SettingsPage', () => {
  it('renders settings links and allows interaction', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    const hapticLink = screen.getByRole('link', { name: /Haptic Devices/i });
    fireEvent.click(hapticLink);
    expect(hapticLink).toHaveAttribute('href', '/settings/devices');
  });
});
