import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Input from './Input';

describe('Input', () => {
  it('renders with base class and accepts placeholder', () => {
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here');
    expect(input.className).toContain('input');
  });

  it('calls onChange and supports className', () => {
    const onChange = vi.fn();
    render(<Input aria-label="Email" className="extra" onChange={onChange} />);

    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'test@dryft.site' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input.className).toContain('extra');
  });

  it('supports disabled state', () => {
    render(<Input aria-label="Disabled input" disabled />);
    expect(screen.getByLabelText('Disabled input')).toBeDisabled();
  });
});
