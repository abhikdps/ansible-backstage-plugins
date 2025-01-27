describe('Ansible Portal Wizard Catalog My Items Page Functional Tests', () => {
  beforeEach(() => {
    // Visit the page
    cy.visit('/wizard/my-items');
  });

  it('Validates the page header', () => {
    cy.get('h1 > div > div').as('pageHeader');
    cy.get('@pageHeader').should('have.text', 'My items');
  });

  it('Validates scenarios with or without records in the my items table', () => {
    cy.get('.MuiTableContainer-root').then($body => {
      if (
        $body.find('table').length &&
        $body.find('table > tbody').length > 0 &&
        $body.find('table > tbody > tr > td').length > 1
      ) {
        cy.get('table > tbody > tr')
          .first()
          .within(() => {
            cy.get('button').click();
            cy.url().should('include', '/wizard/my-items/default/');
            cy.go('back');
          });
      } else {
        cy.contains('No tasks found').should('be.visible');
      }
    });
  });

  it('Validates the Owner dropdown options', () => {
    const ownerContainer =
      '#root > div > main > article > div > .MuiGrid-root > form > div > .MuiInputBase-root > div';

    cy.get(ownerContainer).click().should('contain.text', '');
    cy.get('.MuiInputBase-root > input').should('have.attr', 'value', '');

    cy.get('button').contains('Clear all').as('clearButton');

    const ownerOptions = ['All', 'My'];

    ownerOptions.forEach(option => {
      cy.get('li').should('contain.text', option);
    });

    cy.contains('li', 'All').click();
    cy.get(ownerContainer).should('contain.text', 'All');
    cy.get('.MuiInputBase-root > input').should('have.attr', 'value', 'all');

    cy.get('@clearButton').click();

    cy.get(ownerContainer).click();

    cy.contains('li', 'My').click();
    cy.get(ownerContainer).should('contain.text', 'My');
    cy.get('.MuiInputBase-root > input').should('have.attr', 'value', 'owned');

    cy.get('@clearButton').click();
    cy.get(ownerContainer).should('contain.text', '');
  });

  it('Validates the column headers correctly in the table', () => {
    cy.get('table').within(() => {
      cy.contains('Name').should('be.visible');
      cy.contains('Created at').should('be.visible');
      cy.contains('Owner').should('be.visible');
      cy.contains('Status').should('be.visible');
    });
  });

  it('Validates the pagination controls correctly', () => {
    cy.get('.MuiTablePagination-toolbar').should('be.visible');
    cy.contains('Rows per page').should('be.visible');

    cy.get('.MuiTablePagination-input').should('contain.text', '10').click();
    cy.get('li').contains('25').click();
    cy.get('.MuiTablePagination-input').should('contain.text', '25');

    cy.get('.MuiTablePagination-displayedRows').should('be.visible');

    cy.get('[aria-label="first page"]').should('have.attr', 'type', 'button');
    cy.get('[aria-label="previous page"]').should(
      'have.attr',
      'type',
      'button',
    );
    cy.get('[aria-label="next page"]').should('have.attr', 'type', 'button');
    cy.get('[aria-label="last page"]').should('have.attr', 'type', 'button');
  });
});
