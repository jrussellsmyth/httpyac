import * as got from 'got';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

import { log } from '../../io';
import * as models from '../../models';
import * as utils from '../../utils';
import { getSerivceData, ServiceData } from './createGrpcService';
import { isGrpcWebRequest } from './grpcWebRequest';

export class GrpcWebRequestClient extends models.AbstractRequestClient<typeof got.default> {
  private responseTemplate: Partial<models.HttpResponse> & { protocol: string } = {
    protocol: 'GRPC_WEB',
  };
  private cancelableRequest: got.CancelableRequest<got.Response<unknown>> | undefined;

  constructor(
    private readonly request: models.Request,
    private readonly context: models.ProtoProcessorContext
  ) {
    super();
  }

  get reportMessage(): string {
    return `perform gRPC-Web Request (${this.request.url})`;
  }

  get supportsStreaming() {
    return true;
  }

  get nativeClient(): typeof got.default {
    return got.default;
  }

  private _serviceData: ServiceData | undefined;

  async connect(): Promise<typeof got.default> {
    if (isGrpcWebRequest(this.request)) {
      const protoDefinitions = this.context.options.protoDefinitions;
      if (protoDefinitions) {
        this._serviceData = getSerivceData(this.request.url || '', protoDefinitions);
      } else {
        log.error('no protodefinitions found in context');
        throw new Error('Missing Protodefinitions');
      }
    }
    return this.nativeClient;
  }

  async send(body?: unknown): Promise<void> {
    if (!isGrpcWebRequest(this.request) || !this._serviceData) {
      return;
    }

    try {
      const data = this.getData(body || this.request.body);
      const encodedBody = this.encodeGrpcWebMessage(data);

      // Construct the full URL for the gRPC-Web service
      const protocol = this._serviceData.protocol || 'https';
      const pathPrefix = this._serviceData.path ? `${this._serviceData.path}/` : '';
      const fullUrl = `${protocol}://${this._serviceData.server}/${pathPrefix}${this._serviceData.service}/${this._serviceData.method}`;

      const headers: Record<string, string> = {
        'content-type': 'application/grpc-web+proto',
        'x-grpc-web': '1',
        'x-user-agent': 'httpyac/grpc-web',
      };

      // Add custom headers from request
      if (this.request.headers) {
        for (const [key, value] of Object.entries(this.request.headers)) {
          if (utils.isString(value)) {
            headers[key] = value;
          }
        }
      }

      const options: got.OptionsOfUnknownResponseBody = {
        method: 'POST',
        headers,
        body: encodedBody,
        responseType: 'buffer',
        throwHttpErrors: false,
        timeout: this.request.timeout,
      };

      // Handle proxy settings
      if (this.request.proxy) {
        this.initProxy(options, this.request.proxy);
      }

      if (this.request.noRejectUnauthorized) {
        options.https = { rejectUnauthorized: false };
      }

      this.cancelableRequest = got.default(fullUrl, options);

      const response = (await this.cancelableRequest) as got.Response<Buffer>;

      // Parse gRPC-Web response
      this.handleGrpcWebResponse(response);
    } catch (err) {
      if (err instanceof got.CancelError) {
        return;
      }
      throw err;
    } finally {
      delete this.cancelableRequest;
    }
  }

  override disconnect(err?: Error): void {
    if (err) {
      this.cancelableRequest?.cancel();
    }
    this.onDisconnect();
  }

  private initProxy(options: got.OptionsOfUnknownResponseBody, proxy: string) {
    if (proxy.startsWith('socks://')) {
      const socksProxy = new SocksProxyAgent(proxy);
      options.agent = {
        http: socksProxy,
        https: socksProxy,
      };
    } else {
      options.agent = {
        http: new HttpProxyAgent(proxy),
        https: new HttpsProxyAgent(proxy),
      };
    }
  }

  private getData(body: unknown): unknown {
    if (utils.isString(body)) {
      return JSON.parse(body);
    }
    if (Buffer.isBuffer(body)) {
      return JSON.parse(body.toString('utf-8'));
    }
    return body;
  }

  private encodeGrpcWebMessage(data: unknown): Buffer {
    // gRPC-Web message format:
    // 1 byte: flag (0 for data, 0x80 for trailer)
    // 4 bytes: message length (big-endian)
    // N bytes: message data (protobuf encoded)

    let messageData: Buffer;

    // Use protobuf serialization if available
    if (this._serviceData?.methodDefinition?.requestSerialize) {
      messageData = this._serviceData.methodDefinition.requestSerialize(data);
    } else {
      // Fallback to JSON encoding
      messageData = Buffer.from(JSON.stringify(data), 'utf-8');
    }

    const messageLength = messageData.length;

    const buffer = Buffer.alloc(5 + messageLength);
    buffer.writeUInt8(0, 0); // flag: data frame
    buffer.writeUInt32BE(messageLength, 1); // message length
    messageData.copy(buffer, 5); // message data

    return buffer;
  }

  private handleGrpcWebResponse(response: got.Response<Buffer>): void {
    const rawBody = response.body;
    const headers: Record<string, unknown> = {};

    // Extract headers
    for (const [key, value] of Object.entries(response.headers)) {
      headers[key] = value;
    }

    this.responseTemplate.headers = headers;

    // Parse gRPC-Web frames
    let offset = 0;
    let statusCode = 0;
    let statusMessage = 'OK';
    let messageBody: unknown;

    while (offset < rawBody.length) {
      if (offset + 5 > rawBody.length) {
        break;
      }

      const flag = rawBody.readUInt8(offset);
      const length = rawBody.readUInt32BE(offset + 1);
      offset += 5;

      if (offset + length > rawBody.length) {
        break;
      }

      const frameData = rawBody.subarray(offset, offset + length);
      offset += length;

      if (flag === 0x80) {
        // Trailer frame - contains status
        const trailerText = frameData.toString('utf-8');
        const trailerLines = trailerText.trim().split('\r\n');
        for (const line of trailerLines) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            if (key === 'grpc-status') {
              statusCode = parseInt(value, 10);
            } else if (key === 'grpc-message') {
              statusMessage = decodeURIComponent(value);
            }
            headers[key] = value;
          }
        }
      } else {
        // Data frame - contains message
        try {
          // Use protobuf deserialization if available
          if (this._serviceData?.methodDefinition?.responseDeserialize) {
            messageBody = this._serviceData.methodDefinition.responseDeserialize(frameData);
          } else {
            // Fallback to JSON parsing
            messageBody = JSON.parse(frameData.toString('utf-8'));
          }
        } catch {
          // If parsing fails, return raw data
          messageBody = frameData;
        }
      }
    }

    // Create HTTP response
    const httpResponse: models.HttpResponse = {
      ...this.responseTemplate,
      statusCode,
      statusMessage,
      headers,
      body: utils.stringifySafe(messageBody, 2),
      rawBody,
      parsedBody: messageBody,
      contentType: {
        mimeType: 'application/grpc-web+proto',
        charset: 'UTF-8',
        contentType: 'application/grpc-web+proto; charset=utf-8',
      },
      request: this.request,
    };

    this.onMessage('message', httpResponse);
  }

  public getSessionId() {
    return utils.replaceInvalidChars(this.request.url);
  }
}
