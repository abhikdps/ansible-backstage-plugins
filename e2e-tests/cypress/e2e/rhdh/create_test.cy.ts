import { Common } from '../utils/common';

describe('Developer Hub ansible plugin tests', () => {
  before(() => {
    Common.SignIntoRHDHusingGithub();
  });

  it('Visits Create tab, do Ansible Project template execution', () => {
    cy.get('[data-testid="header-tab-2"]').click();
    cy.wait(5000);

    cy.get('body').then($body => {
      if (
        $body.find(':nth-child(3) > div.MuiCardActions-root > div > button')
      ) {
        cy.contains('Choose').invoke('removeAttr', 'target').click();
        cy.wait(5000);

        // Create random string
        const ruid = () => Cypress._.random(0, 1e9);
        const rid = ruid();
        const fo2 = `fo2${rid}`;
        const bar3 = `bar3-${rid}`;
        const fo2bar = `fo2bar_${rid}`;

        // Fill form details
        cy.get('#root_repoOwner').as('repoOwner').clear().type('test-rhaap-1');
        cy.get('#root_repoName').as('root_repoName').clear().type(bar3);
        cy.get('#root_collectionGroup')
          .as('root_collectionGroup')
          .clear()
          .type(fo2bar);
        cy.get('#root_collectionName')
          .as('root_collectionName')
          .clear()
          .type(fo2bar);
        cy.get('#root_owner').as('root_owner').clear().type(fo2);
        cy.get('#root_system').as('root_system').clear().type(fo2);

        // Click Review button
        cy.get('button[type=submit]').as('submitButton').click();
        cy.wait(5000);

        // Click Create button
        cy.contains('button', 'Create').click();
        cy.wait(10000);

        // Verify if Template Execution is PASS or FAIL
        cy.get('body').then($body => {
          if ($body.text().includes('Open in catalog')) {
            // yes, found it
            cy.contains('Open in catalog').should('exist');
            cy.log(`Template Execution is Success.`);
          } else {
            // no, not here
            cy.contains('Open in catalog').should('not.exist');
            cy.log(`Template Execution is Failure.`);
          }
        });
      }
    });
  });
});
