import { Request } from '../../models';

export interface GrpcWebRequest extends Request<'GRPC_WEB'> {
  headers?: Record<string, string>;
}

export function isGrpcWebRequest(request: Request | undefined): request is GrpcWebRequest {
  return request?.protocol === 'GRPC_WEB';
}
