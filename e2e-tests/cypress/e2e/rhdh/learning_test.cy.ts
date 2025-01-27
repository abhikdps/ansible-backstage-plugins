import { Common } from '../utils/common';

describe('Developer Hub ansible plugin tests', () => {
  before(() => {
    Common.LogintoGithub();
  });

  it('Visits Learn tab   and check all links there', () => {
    cy.visit('/');
    cy.wait(5000);
    cy.contains('Sign In').invoke('removeAttr', 'target').click();
    cy.wait(30000);
    cy.contains('Ansible').click();
    cy.url().should('include', '/ansible');
    cy.wait(5000);
    cy.get('[data-testid="header-tab-3"]').click();
  });
});
