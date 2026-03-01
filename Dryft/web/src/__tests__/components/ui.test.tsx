import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

describe('UI components', () => {
  it('renders Button with default and secondary variants', () => {
    const { rerender } = render(<Button>Primary</Button>);
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain('btn-primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' }).className).toContain('btn-secondary');
  });

  it('renders Card as a link when href is provided', () => {
    render(
      <Card href="/test">
        <span>Card content</span>
      </Card>
    );

    const link = screen.getByRole('link', { name: 'Card content' });
    expect(link).toHaveAttribute('href', '/test');
  });

  it('renders Input with base class', () => {
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here');
    expect(input.className).toContain('input');
  });

  it('renders Modal content and calls onClose when overlay is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal open onClose={handleClose} closeOnOverlayClick>
        <div>Modal body</div>
      </Modal>
    );

    expect(screen.getByText('Modal body')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Modal body').parentElement!.parentElement!);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders LoadingSpinner variants', () => {
    const { rerender, container } = render(<LoadingSpinner />);
    const ring = container.firstChild as HTMLElement;
    expect(ring.className).toContain('border-t-2');

    rerender(<LoadingSpinner variant="inline" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
