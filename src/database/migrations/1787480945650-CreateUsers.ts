import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1787480945650 implements MigrationInterface {
  name = 'CreateUsers1787480945650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "external_id" character varying NOT NULL, "email" character varying, "display_name" character varying NOT NULL, "avatar_url" character varying, "locale" character varying, "timezone" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_users_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_tenant_id_external_id_uindex" ON "users" ("tenant_id", "external_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_tenant_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."users_tenant_id_external_id_uindex"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
