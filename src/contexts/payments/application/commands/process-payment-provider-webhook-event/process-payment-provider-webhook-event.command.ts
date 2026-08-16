export type ProcessPaymentProviderWebhookEventCommandInput = {
  rawBody: Buffer;
  signature: string;
};

/**
 * `rawBody`/`signature` are intentionally NOT value objects: they are a
 * transient transport→port payload (the raw bytes needed for signature
 * verification), never a stored aggregate field — same rationale as
 * `UploadFileCommand.content` in the sibling `gardenia-api` repo's `files`
 * context.
 */
export class ProcessPaymentProviderWebhookEventCommand {
  public readonly rawBody: Buffer;
  public readonly signature: string;

  constructor(input: ProcessPaymentProviderWebhookEventCommandInput) {
    this.rawBody = input.rawBody;
    this.signature = input.signature;
  }
}
