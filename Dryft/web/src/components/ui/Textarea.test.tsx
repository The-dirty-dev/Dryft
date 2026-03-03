import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import Textarea from './Textarea';

describe('Textarea', () => {
  it('renders with base classes', () => {
    render(<Textarea aria-label="Notes" />);
    expect(screen.getByLabelText('Notes').className).toContain('min-h-[120px]');
  });

  it('supports value changes and maxLength', () => {
    render(<Textarea aria-label="Message" maxLength={20} />);
    const textarea = screen.getByLabelText('Message') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'hello world' } });
    expect(textarea.value).toBe('hello world');
    expect(textarea).toHaveAttribute('maxLength', '20');
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Ref target" />);
    expect(ref.current).toBe(screen.getByLabelText('Ref target'));
  });
});
