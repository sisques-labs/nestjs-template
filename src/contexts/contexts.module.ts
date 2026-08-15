import { DynamicModule, Module, Type } from '@nestjs/common';

import { TenantModule } from '@contexts/tenant/tenant.module';

// Register every bounded context module here as it's added, e.g.:
// const CONTEXT_MODULES = [OrdersModule, CustomersModule];
const CONTEXT_MODULES: (DynamicModule | Type<unknown>)[] = [TenantModule];

@Module({
  imports: [...CONTEXT_MODULES],
})
export class ContextsModule {}
