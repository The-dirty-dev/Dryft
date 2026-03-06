import React from 'react';
import { render, screen } from '@testing-library/react-native';
import MessageBubble from '../../components/MessageBubble';

describe('components/MessageBubble', () => {
  it('renders text message content', () => {
    render(
      <MessageBubble
        message={{
          text: 'Hello from VR',
          timestamp: '10:42',
          isSent: true,
        }}
      />
    );

    expect(screen.getByText('Hello from VR')).toBeTruthy();
    expect(screen.getByText('10:42')).toBeTruthy();
  });

  it('renders image message payload', () => {
    const { UNSAFE_getAllByType } = render(
      <MessageBubble
        message={{
          imageUrl: 'https://cdn.example.com/img.jpg',
          timestamp: '10:43',
          isSent: false,
        }}
      />
    );

    // One Image is expected for image messages.
    expect(UNSAFE_getAllByType(require('react-native').Image).length).toBe(1);
  });

  it('supports sent and received variants', () => {
    const sent = render(
      <MessageBubble
        message={{
          text: 'Sent message',
          timestamp: '10:44',
          isSent: true,
        }}
      />
    );

    expect(sent.getByText('Sent message')).toBeTruthy();

    const received = render(
      <MessageBubble
        message={{
          text: 'Received message',
          timestamp: '10:45',
          isSent: false,
        }}
      />
    );

    expect(received.getByText('Received message')).toBeTruthy();
  });
});
