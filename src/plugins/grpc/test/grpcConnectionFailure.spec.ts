import { ConnectivityState } from '@grpc/grpc-js/build/src/connectivity-state';

import * as models from '../../../models';
import { GrpcRequestClient } from '../grpcRequestClient';
import { GrpcClient } from '../createGrpcService';

describe('GrpcRequestClient - connection failure handling', () => {
  it('should create new client when previous client is in TRANSIENT_FAILURE state', async () => {
    // Create a mock GrpcClient with TRANSIENT_FAILURE state
    const mockPrevClient = {
      close: jest.fn(),
      getChannel: jest.fn(() => ({
        getConnectivityState: jest.fn(() => ConnectivityState.TRANSIENT_FAILURE),
      })),
    } as unknown as GrpcClient;

    // Create a mock request
    const mockRequest: models.Request = {
      url: 'grpc://localhost:50051/TestService/TestMethod',
      protocol: 'GRPC',
      method: 'GRPC',
    };

    // Create a mock context with protoDefinitions
    const mockMethodDefinition = {
      path: '/TestService/TestMethod',
      requestStream: false,
      responseStream: false,
      requestSerialize: jest.fn(),
      requestDeserialize: jest.fn(),
      responseSerialize: jest.fn(),
      responseDeserialize: jest.fn(),
    };

    const mockServiceClass = jest.fn().mockImplementation(() => ({
      getChannel: jest.fn(() => ({
        getConnectivityState: jest.fn(() => ConnectivityState.READY),
      })),
      close: jest.fn(),
    }));
    mockServiceClass.service = {
      TestMethod: mockMethodDefinition,
    };

    const mockContext: models.ProtoProcessorContext = {
      options: {
        protoDefinitions: {
          test: {
            grpcObject: {
              TestService: mockServiceClass,
            },
          },
        },
      },
    } as models.ProtoProcessorContext;

    // Create the GrpcRequestClient
    const client = new GrpcRequestClient(mockRequest, mockContext);

    // Call connect with the previous client in TRANSIENT_FAILURE state
    const result = await client.connect(mockPrevClient);

    // Assert that the previous client was closed
    expect(mockPrevClient.close).toHaveBeenCalled();

    // Assert that a new client was created (not undefined)
    expect(result).toBeDefined();
    expect(result).not.toBe(mockPrevClient);
    expect(mockServiceClass).toHaveBeenCalled();
  });

  it('should reuse client when previous client is in READY state', async () => {
    // Create a mock GrpcClient with READY state
    const mockPrevClient = {
      close: jest.fn(),
      getChannel: jest.fn(() => ({
        getConnectivityState: jest.fn(() => ConnectivityState.READY),
      })),
    } as unknown as GrpcClient;

    // Create a mock request
    const mockRequest: models.Request = {
      url: 'grpc://localhost:50051/TestService/TestMethod',
      protocol: 'GRPC',
      method: 'GRPC',
    };

    const mockServiceClass = jest.fn();

    const mockContext: models.ProtoProcessorContext = {
      options: {
        protoDefinitions: {
          test: {
            grpcObject: {
              TestService: mockServiceClass,
            },
          },
        },
      },
    } as models.ProtoProcessorContext;

    // Create the GrpcRequestClient
    const client = new GrpcRequestClient(mockRequest, mockContext);

    // Call connect with the previous client in READY state
    const result = await client.connect(mockPrevClient);

    // Assert that the previous client was NOT closed
    expect(mockPrevClient.close).not.toHaveBeenCalled();

    // Assert that the previous client is reused
    expect(result).toBe(mockPrevClient);
    expect(mockServiceClass).not.toHaveBeenCalled();
  });
});
