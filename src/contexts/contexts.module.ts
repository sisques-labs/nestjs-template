import { DynamicModule, Module, Type } from '@nestjs/common';

import { PaymentsModule } from '@contexts/payments/payments.module';

// Register every bounded context module here as it's added.
const CONTEXT_MODULES: (DynamicModule | Type<unknown>)[] = [PaymentsModule];

@Module({
  imports: [...CONTEXT_MODULES],
})
export class ContextsModule {}
