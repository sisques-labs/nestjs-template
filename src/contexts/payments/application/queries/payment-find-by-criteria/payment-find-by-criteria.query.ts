import { Criteria } from '@sisques-labs/nestjs-kit';

export class PaymentFindByCriteriaQuery {
  public readonly criteria: Criteria;

  constructor(criteria: Criteria) {
    this.criteria = criteria;
  }
}
