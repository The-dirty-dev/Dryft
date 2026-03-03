import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card', () => {
  it('renders as a div when href is not provided', () => {
    const { container } = render(
      <Card>
        <span>Simple card</span>
      </Card>
    );

    expect(screen.getByText('Simple card')).toBeInTheDocument();
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders as a link when href is provided', () => {
    render(
      <Card href="/store/item-1">
        <span>Linked card</span>
      </Card>
    );

    const link = screen.getByRole('link', { name: 'Linked card' });
    expect(link).toHaveAttribute('href', '/store/item-1');
  });

  it('passes className through', () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild).toHaveClass('custom');
  });
});
