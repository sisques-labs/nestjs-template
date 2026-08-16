import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscriptions')
@Index(
  'IDX_subscriptions_provider_idempotency_key',
  ['provider', 'idempotencyKey'],
  { unique: true },
)
export class SubscriptionTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  provider!: string;

  @Column({
    name: 'provider_subscription_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerSubscriptionId!: string | null;

  @Column({
    name: 'provider_customer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerCustomerId!: string | null;

  @Index('IDX_subscriptions_customer_id')
  @Column({
    name: 'customer_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  customerId!: string;

  @Column({ name: 'price_id', type: 'varchar', length: 255, nullable: false })
  priceId!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status!: string;

  @Column({
    name: 'current_period_start',
    type: 'timestamptz',
    nullable: true,
  })
  currentPeriodStart!: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({
    name: 'cancel_at_period_end',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  cancelAtPeriodEnd!: boolean;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  idempotencyKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
