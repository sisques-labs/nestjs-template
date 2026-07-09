import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { IMcpTool } from '../../domain/interfaces/mcp-tool.interface';
import { IMcpToolContext } from '../../domain/interfaces/mcp-tool-context.interface';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolRegistry } from './mcp-tool-registry.service';

const CONTEXT: IMcpToolContext = {
  requestId: 'b2c3d4e5-f6a7-4901-bcde-f12345678901',
};

describe('McpServerFactory', () => {
  let factory: McpServerFactory;
  let registry: jest.Mocked<McpToolRegistry>;
  let tool: jest.Mocked<IMcpTool>;

  beforeEach(() => {
    tool = {
      name: 'fake_tool',
      title: 'Fake',
      description: 'fake',
      inputSchema: {},
      execute: jest.fn().mockResolvedValue({ content: [] }),
    };
    registry = {
      getTools: jest.fn().mockReturnValue([tool]),
    } as unknown as jest.Mocked<McpToolRegistry>;
    factory = new McpServerFactory(registry);
  });

  it('registers every tool on a fresh server bound to the request context', async () => {
    const registerSpy = jest.spyOn(McpServer.prototype, 'registerTool');

    const server = factory.create(CONTEXT);

    expect(server).toBeInstanceOf(McpServer);
    expect(registerSpy).toHaveBeenCalledWith(
      'fake_tool',
      expect.objectContaining({ description: 'fake', inputSchema: {} }),
      expect.any(Function),
    );

    // The registered callback forwards args + context to the tool.
    const callback = registerSpy.mock.calls[0][2] as (
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    await callback({ foo: 'bar' });
    expect(tool.execute).toHaveBeenCalledWith({ foo: 'bar' }, CONTEXT);

    registerSpy.mockRestore();
  });
});
