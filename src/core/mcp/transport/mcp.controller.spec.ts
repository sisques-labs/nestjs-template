import type { Request, Response } from 'express';

import { McpServerFactory } from '../application/services/mcp-server.factory';
import { McpController } from './mcp.controller';

const mockTransport = {
  handleRequest: jest.fn(),
  close: jest.fn(),
};

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest
    .fn()
    .mockImplementation(() => mockTransport),
}));

describe('McpController', () => {
  let controller: McpController;
  let factory: jest.Mocked<McpServerFactory>;
  let server: { connect: jest.Mock; close: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    server = { connect: jest.fn(), close: jest.fn() };
    factory = {
      create: jest.fn().mockReturnValue(server),
    } as unknown as jest.Mocked<McpServerFactory>;
    controller = new McpController(factory);
  });

  describe('handleRequest()', () => {
    it('creates a per-request server bound to a fresh request context and wires the transport', async () => {
      const req = { body: { jsonrpc: '2.0' } } as unknown as Request;
      const res = { on: jest.fn() } as unknown as Response;

      await controller.handleRequest(req, res);

      expect(factory.create).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: expect.any(String) }),
      );
      expect(server.connect).toHaveBeenCalledWith(mockTransport);
      expect(mockTransport.handleRequest).toHaveBeenCalledWith(
        req,
        res,
        req.body,
      );
      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('generates a distinct requestId per request', async () => {
      const req = { body: {} } as unknown as Request;
      const res = { on: jest.fn() } as unknown as Response;

      await controller.handleRequest(req, res);
      await controller.handleRequest(req, res);

      const [[firstCtx], [secondCtx]] = factory.create.mock.calls as [
        [{ requestId: string }],
        [{ requestId: string }],
      ];
      expect(firstCtx.requestId).not.toBe(secondCtx.requestId);
    });

    it('closes the transport and server when the response closes', async () => {
      const req = { body: {} } as unknown as Request;
      let closeHandler: () => void = () => undefined;
      const res = {
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'close') closeHandler = cb;
        }),
      } as unknown as Response;

      await controller.handleRequest(req, res);
      closeHandler();

      expect(mockTransport.close).toHaveBeenCalledTimes(1);
      expect(server.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsupported methods', () => {
    it('responds 405 for GET', () => {
      const json = jest.fn();
      const res = {
        status: jest.fn().mockReturnValue({ json }),
      } as unknown as Response;

      controller.handleGet(res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ jsonrpc: '2.0' }),
      );
    });

    it('responds 405 for DELETE', () => {
      const json = jest.fn();
      const res = {
        status: jest.fn().mockReturnValue({ json }),
      } as unknown as Response;

      controller.handleDelete(res);

      expect(res.status).toHaveBeenCalledWith(405);
    });
  });
});
