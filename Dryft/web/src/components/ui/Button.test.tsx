import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders default variant and handles click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Press</Button>);

    const button = screen.getByRole('button', { name: 'Press' });
    expect(button.className).toContain('btn-primary');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders secondary and ghost variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' }).className).toContain('btn-secondary');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button', { name: 'Ghost' }).className).toContain('btn-ghost');
  });

  it('supports disabled state and className passthrough', () => {
    render(
      <Button disabled className="custom-class">
        Disabled
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('custom-class');
  });
});
