import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientId } from '../lib/client-id.ts';

test('client IDs remain valid UUID v4 values without crypto.randomUUID', () => {
  const source = {
    getRandomValues(array) {
      array.forEach((_, index) => { array[index] = index; });
      return array;
    },
  };
  const id = createClientId(source);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(id, '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('client IDs use native randomUUID when available', () => {
  const expected = '12345678-1234-4234-9234-123456789abc';
  assert.equal(createClientId({ randomUUID: () => expected }), expected);
});
