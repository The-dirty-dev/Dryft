import * as uploadsService from '../../services/uploads';

describe('services/uploads', () => {
  it('exports uploadFile function', () => {
    expect(typeof uploadsService.uploadFile).toBe('function');
  });

  it('exports uploadMultipleFiles function', () => {
    expect(typeof uploadsService.uploadMultipleFiles).toBe('function');
  });

  it('exports picker helpers', () => {
    expect(typeof uploadsService.pickImage).toBe('function');
    expect(typeof uploadsService.takePhoto).toBe('function');
  });
});
