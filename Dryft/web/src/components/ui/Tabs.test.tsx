import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Tabs from './Tabs';

const tabItems = [
  { id: 'one', label: 'One', content: <div>Tab One</div> },
  { id: 'two', label: 'Two', content: <div>Tab Two</div> },
  { id: 'three', label: 'Three', content: <div>Tab Three</div>, disabled: true },
];

describe('Tabs', () => {
  it('renders first tab content by default', () => {
    render(<Tabs tabs={tabItems} />);
    expect(screen.getByText('Tab One')).toBeInTheDocument();
  });

  it('switches tabs and calls onChange', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabItems} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(screen.getByText('Tab Two')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('respects disabled tabs', () => {
    render(<Tabs tabs={tabItems} />);

    const disabledTab = screen.getByRole('button', { name: 'Three' });
    expect(disabledTab).toBeDisabled();

    fireEvent.click(disabledTab);
    expect(screen.queryByText('Tab Three')).toBeNull();
  });
});
