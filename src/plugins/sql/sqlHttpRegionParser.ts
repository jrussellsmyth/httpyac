import * as utils from '../../utils';
import { SQLRequestClient } from './sqlRequestClient';
import { userSessionStore } from '../../store';

export const parseSqlLine = utils.parseRequestLineFactory({
  protocol: 'SQL',
  methodRegex: /^\s*(SQL)\s+(?<url>.+?)\s*$/u,
  protocolRegex: /^\s*(?<url>postgresql:\/\/.+?)\s*$/iu,
  requestClientFactory(request, context) {
    return new SQLRequestClient(request, context);
  },
  sessionStore: userSessionStore,
});