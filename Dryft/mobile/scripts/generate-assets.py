#!/usr/bin/env python3
"""
Generate placeholder app assets for Drift
Creates properly formatted PNG files with solid colors (fast generation)
"""

import zlib
import struct
import os

def create_solid_png(width, height, r, g, b, a, output_path):
    """
    Create a solid color PNG file efficiently
    """
    def png_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_data = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk_data) & 0xffffffff)
        return chunk_len + chunk_data + crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # Generate raw pixel data - one row, then repeat
    row = b'\x00' + bytes([r, g, b, a]) * width  # Filter byte + pixels
    raw_data = row * height

    # IDAT chunk (compressed pixel data)
    compressed = zlib.compress(raw_data, 9)
    idat = png_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = png_chunk(b'IEND', b'')

    # Write PNG file
    with open(output_path, 'wb') as f:
        f.write(signature + ihdr + idat + iend)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"Created: {output_path} ({width}x{height}, {size_kb:.1f} KB)")

def main():
    # Get the assets directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(script_dir, '..', 'assets')
    sounds_dir = os.path.join(assets_dir, 'sounds')

    # Create directories
    os.makedirs(assets_dir, exist_ok=True)
    os.makedirs(sounds_dir, exist_ok=True)

    print("Generating Drift app assets...")
    print()

    # Drift brand colors
    # Primary purple: #6B46C1 (107, 70, 193)
    # Primary pink: #EC4899 (236, 72, 153)
    # Dark purple: #4C1D95 (76, 29, 149)

    # App Icon (1024x1024) - Purple brand color
    create_solid_png(1024, 1024, 107, 70, 193, 255,
                     os.path.join(assets_dir, 'icon.png'))

    # Adaptive Icon (1024x1024) - Same as icon
    create_solid_png(1024, 1024, 107, 70, 193, 255,
                     os.path.join(assets_dir, 'adaptive-icon.png'))

    # Splash Screen (1284x2778) - Dark purple
    create_solid_png(1284, 2778, 76, 29, 149, 255,
                     os.path.join(assets_dir, 'splash.png'))

    # Favicon (48x48) - Brand purple
    create_solid_png(48, 48, 107, 70, 193, 255,
                     os.path.join(assets_dir, 'favicon.png'))

    # Notification Icon (96x96) - White
    create_solid_png(96, 96, 255, 255, 255, 255,
                     os.path.join(assets_dir, 'notification-icon.png'))

    # Create minimal WAV files for sounds
    create_minimal_wav(os.path.join(sounds_dir, 'notification.wav'))
    create_minimal_wav(os.path.join(sounds_dir, 'match.wav'))

    print()
    print("✅ All assets generated successfully!")
    print()
    print("Note: These are solid color placeholders.")
    print("Replace with actual branded assets before production.")

def create_minimal_wav(output_path):
    """Create a minimal valid WAV file (silence)"""
    # WAV header for 1 second of silence at 44100Hz, 16-bit mono
    sample_rate = 44100
    duration = 0.5  # half second
    num_samples = int(sample_rate * duration)

    # WAV file structure
    wav_data = bytearray()

    # RIFF header
    wav_data.extend(b'RIFF')
    wav_data.extend(struct.pack('<I', 36 + num_samples * 2))  # file size - 8
    wav_data.extend(b'WAVE')

    # fmt chunk
    wav_data.extend(b'fmt ')
    wav_data.extend(struct.pack('<I', 16))  # chunk size
    wav_data.extend(struct.pack('<H', 1))   # audio format (PCM)
    wav_data.extend(struct.pack('<H', 1))   # num channels
    wav_data.extend(struct.pack('<I', sample_rate))  # sample rate
    wav_data.extend(struct.pack('<I', sample_rate * 2))  # byte rate
    wav_data.extend(struct.pack('<H', 2))   # block align
    wav_data.extend(struct.pack('<H', 16))  # bits per sample

    # data chunk
    wav_data.extend(b'data')
    wav_data.extend(struct.pack('<I', num_samples * 2))  # data size

    # Silent audio data (zeros)
    wav_data.extend(bytes(num_samples * 2))

    with open(output_path, 'wb') as f:
        f.write(wav_data)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"Created: {output_path} ({duration}s silence, {size_kb:.1f} KB)")

if __name__ == '__main__':
    main()
