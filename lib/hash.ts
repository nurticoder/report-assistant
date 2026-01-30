import crypto from 'crypto';

export function sha256(buffer: ArrayBuffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

