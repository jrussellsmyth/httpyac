import { ClientConfig } from 'pg';

import { Request } from '../../models';

export interface SQLRequest extends Request<'SQL'> {
  headers?: Record<string, string | string[] | undefined> | undefined;
  body?: string;
  options?: ClientConfig;
}

export function isSQLRequest(request: Request | undefined): request is SQLRequest {
  return request?.protocol === 'SQL';
}