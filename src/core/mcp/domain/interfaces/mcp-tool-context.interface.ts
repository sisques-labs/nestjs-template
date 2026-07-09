/**
 * Per-request context handed to every MCP tool.
 *
 * Built by the MCP transport controller from the incoming request. This
 * service ships without auth/tenancy, so the only field is a request
 * correlation id — extend this interface once the service gains
 * authentication (e.g. add `userId`) or multi-tenancy (e.g. add `tenantId`),
 * so tools receive resolved identity instead of reading HTTP primitives
 * directly.
 */
export interface IMcpToolContext {
  /** Correlation id for this MCP request — useful for tracing/log correlation. */
  readonly requestId: string;
}
