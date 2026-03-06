import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ItemCard from '../../components/ItemCard';

const baseItem: any = {
  id: 'item-1',
  name: 'Neon Outfit',
  creator_name: 'Dryft Creator',
  thumbnail_url: 'https://cdn.example.com/outfit.png',
  price: 1499,
  currency: 'usd',
  rating: 4.8,
  rating_count: 25,
  is_featured: false,
  is_owned: false,
};

describe('components/ItemCard', () => {
  it('renders item name and price', () => {
    render(<ItemCard item={baseItem} onPress={jest.fn()} />);

    expect(screen.getByText('Neon Outfit')).toBeTruthy();
    expect(screen.getByText('$14.99')).toBeTruthy();
  });

  it('triggers onPress callback when card is tapped', () => {
    const onPress = jest.fn();
    render(<ItemCard item={baseItem} onPress={onPress} />);

    fireEvent.press(screen.getByText('Neon Outfit'));

    expect(onPress).toHaveBeenCalled();
  });

  it('renders compact mode and free label', () => {
    render(<ItemCard item={{ ...baseItem, price: 0 }} compact onPress={jest.fn()} />);

    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('shows featured badge when item is featured', () => {
    render(<ItemCard item={{ ...baseItem, is_featured: true }} onPress={jest.fn()} />);

    expect(screen.getByText('Featured')).toBeTruthy();
  });
});
