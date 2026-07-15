# Changelog

All notable changes to this project will be documented in this file.
## [0.1.4] - 2026-07-15

### Chore
- Extend shared Renovate config, remove Dependabot (a0275ae)
## [0.1.3] - 2026-07-15

### Chore
- **deps-dev:** Bump @typescript-eslint/eslint-plugin (5149f34)
## [0.1.2] - 2026-07-15

### Chore
- **deps:** Bump @nestjs/cqrs from 10.2.8 to 11.0.3 (2eda514)
- **deps-dev:** Bump @typescript-eslint/parser from 8.63.0 to 8.64.0 (f5a5f8c)
- **deps:** Bump @nestjs/terminus from 10.3.0 to 11.1.1 (d1a1b3e)
- **deps-dev:** Bump @nestjs/cli from 11.0.23 to 11.0.24 (1a3972c)
- **deps-dev:** Bump @types/supertest from 7.2.0 to 7.2.1 (67c16b3)
- **deps:** Bump docker/setup-qemu-action from 3 to 4 (1bd4468)
- **deps:** Bump docker/setup-buildx-action from 3 to 4 (0057997)
- **deps:** Bump @sisques-labs/nestjs-kit from 1.2.1 to 1.3.1 (007d140)
- **deps-dev:** Bump eslint-plugin-boundaries from 6.0.2 to 7.0.2 (fb197f7)
- **deps:** Bump docker/build-push-action from 6 to 7 (000a209)
- **deps:** Bump actions/checkout from 4 to 7 (a76e062)
- **deps:** Bump typeorm from 1.0.0 to 1.1.0 (2cbea3b)
## [0.1.1] - 2026-07-10

### Chore
- **deps-dev:** Bump jest and @types/jest (7023af8)
- **deps-dev:** Bump eslint-config-prettier from 9.1.2 to 10.1.8 (b94aa03)
- **deps-dev:** Bump @nestjs/schematics from 10.2.3 to 11.1.0 (0d880d6)
## [0.1.0] - 2026-07-10

### Chore
- First commit (19b9436)
- **deps-dev:** Bump @types/supertest from 6.0.3 to 7.2.0 (98f7a65)
- Rename package to sisqueslabs/nestjs-template (41f38b4)
- **deps:** Bump @sisques-labs/nestjs-kit to 1.2.1 (5d7cc08)
- Reset package.json version to 0.0.0 (cc5fcde)

### Documentation
- Add docker/README.md for the Docker Hub repository page (efffab5)

### Features
- Bootstrap NestJS service template from gardenia-api conventions (7f53cea)

### Refactor
- **mcp:** Consume @sisques-labs/nestjs-kit/mcp instead of a local copy (34388a4)
- **metrics,messaging:** Consume @sisques-labs/nestjs-kit instead of local copies (10287b5)
- Aggregate core/context wiring into CoreModule/ContextsModule (6885b77)

