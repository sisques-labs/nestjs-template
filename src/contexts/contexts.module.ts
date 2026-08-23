import { DynamicModule, Module, Type } from '@nestjs/common';

import { TenantModule } from '@contexts/tenant/tenant.module';
import { UsersModule } from '@contexts/users/users.module';

// Register every bounded context module here as it's added, e.g.:
// const CONTEXT_MODULES = [OrdersModule, CustomersModule];
const CONTEXT_MODULES: (DynamicModule | Type<unknown>)[] = [
  TenantModule,
  UsersModule,
];

@Module({
  imports: [...CONTEXT_MODULES],
})
export class ContextsModule {}
