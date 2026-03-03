import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <div>Hidden</div>
      </Modal>
    );

    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('renders content when open', () => {
    render(
      <Modal open onClose={() => {}}>
        <div>Visible content</div>
      </Modal>
    );

    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('closes on overlay click when enabled', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} closeOnOverlayClick>
        <div>Body</div>
      </Modal>
    );

    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside content', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} closeOnOverlayClick>
        <div>Body content</div>
      </Modal>
    );

    fireEvent.click(screen.getByText('Body content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
