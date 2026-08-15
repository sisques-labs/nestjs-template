import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenants1786818350610 implements MigrationInterface {
  name = 'CreateTenants1786818350610';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" uuid NOT NULL, "external_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "tenants_external_id_uindex" ON "tenants"  ("external_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."tenants_external_id_uindex"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
  }
}
