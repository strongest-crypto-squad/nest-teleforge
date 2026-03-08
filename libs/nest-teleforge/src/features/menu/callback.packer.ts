import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
interface Unpacked {
  version: number;
  rootShort: string;
  segments: string[];
  valid: boolean;
}
@Injectable()
export class CallbackPacker {
  private prefix = 'm';
  private version = 1;
  private sigLen = 8;
  private secret = process.env.MENU_HMAC_SECRET ?? 'dev-secret';
  pack(rootShort: string, segments: string[]): string {
    const path = segments.join('.');
    const payload = `${this.version}|${rootShort}|${path}`;
    const sig = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex')
      .slice(0, this.sigLen);
    return `${this.prefix}:${this.version}:${rootShort}:${path}:${sig}`;
  }
  unpack(data: string): Unpacked | null {
    if (!data || !data.startsWith(`${this.prefix}:`)) return null;
    const [, vStr, rootShort, path = '', sig = ''] = data.split(':', 5);
    const version = Number(vStr);
    const payload = `${version}|${rootShort}|${path}`;
    const expect = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex')
      .slice(0, this.sigLen);
    const valid = sig === expect;
    const segments = path ? path.split('.').filter(Boolean) : [];
    return { version, rootShort, segments, valid };
  }
}
