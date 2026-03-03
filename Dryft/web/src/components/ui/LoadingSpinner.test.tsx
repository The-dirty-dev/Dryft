import { render } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders ring variant by default', () => {
    const { container } = render(<LoadingSpinner />);
    const node = container.firstChild as HTMLElement;
    expect(node.tagName.toLowerCase()).toBe('div');
    expect(node.className).toContain('border-t-2');
  });

  it('renders inline variant as svg', () => {
    const { container } = render(<LoadingSpinner variant="inline" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('passes className through', () => {
    const { container } = render(<LoadingSpinner className="h-8" />);
    expect((container.firstChild as HTMLElement).className).toContain('h-8');
  });
});
