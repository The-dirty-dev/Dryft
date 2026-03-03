import { render, screen } from '@testing-library/react';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
  it('renders child and content', () => {
    render(
      <Tooltip content="Helpful text">
        <button type="button">Hover me</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
    expect(screen.getByText('Helpful text')).toBeInTheDocument();
  });

  it('applies position classes', () => {
    const { rerender } = render(
      <Tooltip content="Top" position="top">
        <span>Target</span>
      </Tooltip>
    );
    expect(screen.getByText('Top').className).toContain('bottom-full');

    rerender(
      <Tooltip content="Right" position="right">
        <span>Target</span>
      </Tooltip>
    );
    expect(screen.getByText('Right').className).toContain('left-full');
  });
});
