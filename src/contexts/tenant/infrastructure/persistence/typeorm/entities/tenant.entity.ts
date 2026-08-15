import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM persistence model for `Tenant`.
 *
 * Deliberately does NOT extend `BaseTypeormEntity` from
 * `@sisques-labs/nestjs-kit/typeorm`: that base class names its columns
 * after the (camelCase) property names verbatim — this app configures no
 * global naming strategy (see `src/core/config/postgres.config.ts`) — and
 * adds a `deletedAt` soft-delete column this context has no use for
 * (`Tenant` has no delete operation in v1, see `add-tenant-context`
 * proposal's "Out of scope"). This entity instead declares explicit
 * snake_case column names to match the `tenant-context` spec.
 */
@Entity('tenants')
export class TenantEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index('tenants_external_id_uindex', { unique: true })
  @Column({ name: 'external_id', type: 'varchar' })
  externalId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
