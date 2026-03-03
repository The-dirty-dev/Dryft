import { render, screen, fireEvent } from '@testing-library/react';
import Dropdown from './Dropdown';

describe('Dropdown', () => {
  it('opens and closes on trigger click', () => {
    render(
      <Dropdown trigger={<span>Open menu</span>}>
        <div>Item A</div>
      </Dropdown>
    );

    expect(screen.queryByText('Item A')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('Item A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByText('Item A')).toBeNull();
  });

  it('closes on outside click', () => {
    render(
      <div>
        <Dropdown trigger={<span>Actions</span>}>
          <div>Delete</div>
        </Dropdown>
        <button type="button">Outside</button>
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByText('Delete')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('applies right alignment class when requested', () => {
    const { container } = render(
      <Dropdown trigger={<span>More</span>} align="right">
        <div>Item</div>
      </Dropdown>
    );

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(container.querySelector('.right-0')).toBeTruthy();
  });
});
