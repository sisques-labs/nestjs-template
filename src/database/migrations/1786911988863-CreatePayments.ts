import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * First migration in this template. Enables `uuid-ossp` (needed for
 * `uuid_generate_v4()` on `PrimaryGeneratedColumn('uuid')`) since no earlier
 * migration has done so yet, then creates the `payments` context's tables.
 * No foreign keys — the template has no `customers`/`users` table to
 * reference; `customer_id` stays an opaque string (see the context README).
 */
export class CreatePayments1786911988863 implements MigrationInterface {
  name = 'CreatePayments1786911988863';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying(20) NOT NULL,
        "provider_payment_id" character varying(255),
        "customer_id" character varying(255) NOT NULL,
        "amount" integer NOT NULL,
        "currency" character varying(3) NOT NULL,
        "status" character varying(20) NOT NULL,
        "idempotency_key" character varying(255) NOT NULL,
        "refunded_amount" integer NOT NULL DEFAULT 0,
        "description" character varying(500),
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_payments_provider_idempotency_key" ON "payments" ("provider", "idempotency_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_customer_id" ON "payments" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying(20) NOT NULL,
        "provider_subscription_id" character varying(255),
        "provider_customer_id" character varying(255),
        "customer_id" character varying(255) NOT NULL,
        "price_id" character varying(255) NOT NULL,
        "status" character varying(20) NOT NULL,
        "current_period_start" TIMESTAMP WITH TIME ZONE,
        "current_period_end" TIMESTAMP WITH TIME ZONE,
        "cancel_at_period_end" boolean NOT NULL DEFAULT false,
        "idempotency_key" character varying(255) NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_subscriptions_provider_idempotency_key" ON "subscriptions" ("provider", "idempotency_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_customer_id" ON "subscriptions" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying(20) NOT NULL,
        "provider_event_id" character varying(255) NOT NULL,
        "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_webhook_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_payment_webhook_events_provider_event_id" ON "payment_webhook_events" ("provider", "provider_event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_webhook_events"`);
    await queryRunner.query(`
      DROP INDEX "IDX_subscriptions_customer_id"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_subscriptions_provider_idempotency_key"
    `);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_customer_id"`);
    await queryRunner.query(`
      DROP INDEX "IDX_payments_provider_idempotency_key"
    `);
    await queryRunner.query(`DROP TABLE "payments"`);
  }
}
