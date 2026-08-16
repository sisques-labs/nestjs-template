import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('payment_webhook_events')
@Index(
  'IDX_payment_webhook_events_provider_event_id',
  ['provider', 'providerEventId'],
  { unique: true },
)
export class PaymentWebhookEventTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  provider!: string;

  @Column({
    name: 'provider_event_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  providerEventId!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
