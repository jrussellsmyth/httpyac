import * as pg from 'pg';

import { javascriptProvider } from '../../io';
import * as models from '../../models';
import { parseSqlLine } from './sqlHttpRegionParser';
import { parseSQLResponse } from './sqlResponseHttpRegionParser';

export function registerSqlPlugin(api: models.HttpyacHooksApi) {
  api.hooks.parse.addHook('sql', parseSqlLine, { before: ['request'] });
  api.hooks.parse.addHook('sqlResponse', parseSQLResponse, { before: ['requestBody'] });
  javascriptProvider.require.pg = pg;
}