import { DiscoveryService, Reflector } from '@nestjs/core';

import { IMcpTool } from '../../domain/interfaces/mcp-tool.interface';
import { MCP_TOOL_METADATA } from '../../domain/constants/mcp-tool.constants';
import { McpToolRegistry } from './mcp-tool-registry.service';

class FakeTool implements IMcpTool {
  readonly name = 'fake_tool';
  readonly description = 'fake';
  readonly inputSchema = {};
  execute = jest.fn();
}

class NotATool {}

describe('McpToolRegistry', () => {
  let registry: McpToolRegistry;
  let discoveryService: jest.Mocked<DiscoveryService>;
  let reflector: jest.Mocked<Reflector>;

  const tool = new FakeTool();
  const nonTool = new NotATool();

  beforeEach(() => {
    discoveryService = {
      getProviders: jest
        .fn()
        .mockReturnValue([
          { instance: tool },
          { instance: nonTool },
          { instance: undefined },
        ]),
    } as unknown as jest.Mocked<DiscoveryService>;
    reflector = {
      get: jest.fn((key: unknown, target: unknown) =>
        key === MCP_TOOL_METADATA && target === FakeTool ? true : undefined,
      ),
    } as unknown as jest.Mocked<Reflector>;
    registry = new McpToolRegistry(discoveryService, reflector);
  });

  it('collects only providers tagged with the MCP tool metadata', () => {
    registry.onModuleInit();

    expect(registry.getTools()).toEqual([tool]);
  });

  it('ignores providers without an instance', () => {
    registry.onModuleInit();

    expect(registry.getTools()).not.toContain(undefined);
  });
});
