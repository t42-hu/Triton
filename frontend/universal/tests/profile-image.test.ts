import assert from 'node:assert/strict';
import test from 'node:test';
import { PROFILE_IMAGE_LIMIT, profileImageType } from '../src/domain/profile-image';

test('accepts picker and dropped images with a missing MIME type', () => {
  assert.equal(profileImageType({ uri: '', name: 'photo.JPG', size: 1024 }), 'image/jpeg');
  assert.equal(profileImageType({ uri: '', name: 'photo', mimeType: 'image/png', size: PROFILE_IMAGE_LIMIT }), 'image/png');
});

test('rejects unsupported content even with an image filename', () => {
  assert.throws(() => profileImageType({ uri: '', name: 'photo.jpg', mimeType: 'application/pdf', size: 10 }), /JPEG, PNG vagy WebP/);
  assert.throws(() => profileImageType({ uri: '', name: 'photo.gif', size: 10 }), /JPEG, PNG vagy WebP/);
});

test('rejects empty and oversized files before uploading', () => {
  assert.throws(() => profileImageType({ uri: '', name: 'photo.png', size: 0 }), /üres/);
  assert.throws(() => profileImageType({ uri: '', name: 'photo.webp', size: PROFILE_IMAGE_LIMIT + 1 }), /5 MB/);
});
