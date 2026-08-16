import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payments')
@Index(
  'IDX_payments_provider_idempotency_key',
  ['provider', 'idempotencyKey'],
  {
    unique: true,
  },
)
export class PaymentTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  provider!: string;

  @Column({
    name: 'provider_payment_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerPaymentId!: string | null;

  @Index('IDX_payments_customer_id')
  @Column({
    name: 'customer_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  customerId!: string;

  @Column({ type: 'integer', nullable: false })
  amount!: number;

  @Column({ type: 'varchar', length: 3, nullable: false })
  currency!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status!: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  idempotencyKey!: string;

  @Column({
    name: 'refunded_amount',
    type: 'integer',
    nullable: false,
    default: 0,
  })
  refundedAmount!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
