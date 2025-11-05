import { userSessionStore } from '../../store';
import * as utils from '../../utils';
import { GrpcWebRequestClient } from './grpcWebRequestClient';

export const parseGrpcWebLine = utils.parseRequestLineFactory({
  protocol: 'GRPC_WEB',
  methodRegex: /^\s*(GRPC_WEB|GRPC-WEB)\s+(?<url>.+?)\s*$/u,
  protocolRegex: /^\s*(?<url>grpc-web:\/\/.+?)\s*$/iu,
  requestClientFactory(request, context) {
    return new GrpcWebRequestClient(request, context);
  },
  modifyRequest(request) {
    request.supportsStreaming = true;
  },
  sessionStore: userSessionStore,
});
