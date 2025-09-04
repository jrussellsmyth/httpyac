import { Client, ClientConfig } from 'pg';

import { log } from '../../io';
import * as models from '../../models';
import * as utils from '../../utils';
import { isSQLRequest, SQLRequest } from './sqlRequest';

export class SQLRequestClient extends models.AbstractRequestClient<Client | undefined> {
  private responseTemplate: Partial<models.HttpResponse> & { protocol: string } = {
    protocol: 'SQL',
  };

  constructor(
    private readonly request: models.Request,
    private readonly context: models.ProcessorContext
  ) {
    super();
  }

  get reportMessage(): string {
    return `perform SQL Request (${this.request.url})`;
  }

  get supportsStreaming() {
    return false;
  }

  private _nativeClient: Client | undefined;
  get nativeClient(): Client | undefined {
    return this._nativeClient;
  }

  async connect(): Promise<Client | undefined> {
    if (isSQLRequest(this.request)) {
      const config = this.getClientConfig(this.request, this.context);
      this._nativeClient = new Client(config);
      await this._nativeClient.connect();
    }
    return this._nativeClient;
  }

  async send(body?: unknown): Promise<void> {
    if (isSQLRequest(this.request) && this.nativeClient) {
      const sql = utils.toString(body || this.request.body);
      if (!sql) {
        throw new Error('SQL query is required');
      }

      try {
        const result = await this.nativeClient.query(sql);
        
        this.onMessage('result', {
          ...this.responseTemplate,
          statusCode: 200,
          name: `SQL Query (${this.request.url})`,
          message: `Query executed successfully`,
          request: this.request,
          body: JSON.stringify(result.rows, null, 2),
          rawBody: Buffer.from(JSON.stringify(result.rows)),
          headers: {
            'row-count': result.rowCount?.toString() || '0',
            'command': result.command || 'UNKNOWN',
            'fields': result.fields?.length.toString() || '0'
          },
          parsedBody: result.rows,
          meta: {
            command: result.command,
            rowCount: result.rowCount,
            fields: result.fields,
            oid: result.oid,
          }
        });
      } catch (err) {
        this.onMessage('error', {
          ...this.responseTemplate,
          statusCode: 500,
          request: this.request,
          body: utils.errorToString(err),
          message: `SQL Error: ${utils.errorToString(err)}`,
        });
      }
    }
  }

  disconnect(err?: Error): void {
    if (this.nativeClient) {
      this.nativeClient.end().catch(closeErr => {
        if (closeErr && !err) {
          log.error('error on close', closeErr);
        }
      });
    }
    this.onDisconnect();
  }

  private getClientConfig(request: SQLRequest, context: models.ProcessorContext): ClientConfig {
    const { config } = context;

    const configOptions: ClientConfig = {};
    
    // Parse PostgreSQL connection string
    if (request.url) {
      configOptions.connectionString = request.url;
    }

    // Apply timeout configuration if available
    if (config?.request) {
      const timeout = request.timeout || utils.toNumber(config.request.timeout);
      if (timeout !== undefined) {
        configOptions.connectionTimeoutMillis = timeout;
        configOptions.query_timeout = timeout;
        configOptions.statement_timeout = timeout;
      }
      
      if (!utils.isUndefined(config.request.rejectUnauthorized)) {
        configOptions.ssl = {
          rejectUnauthorized: utils.toBoolean(config.request.rejectUnauthorized, true)
        };
      }
    }

    if (request.noRejectUnauthorized) {
      configOptions.ssl = {
        rejectUnauthorized: false
      };
    }

    // Filter out SQL-specific headers from being passed as connection options
    const headers = Object.fromEntries(
      Object.entries(request.headers || {}).filter(
        ([key]) => ['database', 'host', 'port', 'user', 'password'].indexOf(key.toLowerCase()) < 0
      )
    );

    return Object.assign({}, config?.request, request.options, configOptions, headers);
  }
}