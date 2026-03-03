import { render, screen } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  it('renders title and body', () => {
    render(
      <Toast title="Saved" variant="success">
        All changes were saved.
      </Toast>
    );

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('All changes were saved.')).toBeInTheDocument();
  });

  it('renders variant styles', () => {
    const { rerender } = render(<Toast variant="info">Info</Toast>);
    expect(screen.getByText('Info').parentElement?.className).toContain('bg-surface');

    rerender(<Toast variant="warning">Warn</Toast>);
    expect(screen.getByText('Warn').parentElement?.className).toContain('bg-yellow-500/10');

    rerender(<Toast variant="error">Error</Toast>);
    expect(screen.getByText('Error').parentElement?.className).toContain('bg-red-500/10');
  });
});
