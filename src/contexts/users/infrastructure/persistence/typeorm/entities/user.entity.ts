import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM persistence model for `User`.
 *
 * Deliberately does NOT extend `BaseTypeormEntity` from
 * `@sisques-labs/nestjs-kit/typeorm`, for the same reasons
 * `TenantEntity` doesn't (see that entity's doc comment): this app
 * configures no global naming strategy, and this context has no use for
 * the base class's `deletedAt` soft-delete column.
 *
 * No TypeORM `@ManyToOne`/`@JoinColumn` relation to `TenantEntity` — that
 * would be a raw cross-context infrastructure import, which the
 * architecture skill's boundary rule reserves for a port/adapter, not a
 * direct entity-to-entity relation. Referential integrity to `tenants` is
 * still enforced at the database level via a plain foreign key constraint
 * added in the migration (see `CreateUsers*.ts`) — just not modeled as a
 * TypeORM relation object here.
 */
@Entity('users')
@Index('users_tenant_id_external_id_uindex', ['tenantId', 'externalId'], {
  unique: true,
})
export class UserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'external_id', type: 'varchar' })
  externalId!: string;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ name: 'display_name', type: 'varchar' })
  displayName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
