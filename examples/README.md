# httpyac Examples

This directory contains example `.http` files demonstrating various features of httpyac.

## gRPC-Web Example

See [grpc-web-example.http](./grpc-web-example.http) for examples of using gRPC-Web with httpyac.

### What is gRPC-Web?

gRPC-Web is a protocol that allows browser-based and HTTP/1.1 applications to communicate with gRPC services. It provides a bridge between gRPC servers and clients that cannot use native gRPC (which requires HTTP/2).

### Key Features

- **HTTP/1.1 Compatible**: Works through HTTP proxies and in restricted network environments
- **Protocol Buffer Encoding**: Uses the same efficient protobuf encoding as gRPC
- **Unary & Server Streaming**: Supports both unary calls and server-streaming
- **Browser Compatible**: Can be used in web browsers (though httpyac is a CLI/Node.js tool)

### Usage

1. **Load your proto files**:
   ```
   # @proto ./path/to/service.proto
   ```

2. **Make a gRPC-Web request**:
   ```
   GRPC_WEB localhost:8080/mypackage.MyService/MyMethod
   
   {
     "field": "value"
   }
   ```

   Or using URL protocol syntax:
   ```
   grpc-web://localhost:8080/mypackage.MyService/MyMethod
   
   {
     "field": "value"
   }
   ```

### Differences from Standard gRPC

| Feature | gRPC | gRPC-Web |
|---------|------|----------|
| Transport | HTTP/2 | HTTP/1.1 or HTTP/2 |
| Streaming | Full bidirectional | Unary & server-streaming only |
| Browser Support | No | Yes (with proxy) |
| Wire Format | Binary frames | HTTP messages with length-prefixed frames |
| Syntax in httpyac | `GRPC` or `grpc://` | `GRPC_WEB` or `grpc-web://` |

### When to Use gRPC-Web

- When native gRPC is not available (browser, restricted networks)
- When you need to go through HTTP/1.1 proxies
- When HTTP/2 is not available or not desired
- For testing gRPC services exposed via gRPC-Web gateway (like Envoy proxy)

### Setting up a gRPC-Web Service

To test gRPC-Web, you need a gRPC service exposed through a gRPC-Web proxy like:
- [Envoy Proxy](https://www.envoyproxy.io/)
- [grpcwebproxy](https://github.com/improbable-eng/grpc-web/tree/master/go/grpcwebproxy)
- Built-in gRPC-Web support in some frameworks

## More Information

For complete documentation, visit [httpyac.github.io](https://httpyac.github.io/)
