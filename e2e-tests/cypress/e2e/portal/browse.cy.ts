describe('Ansible Portal Browse Page Functional Tests', () => {
  beforeEach(() => {
    // Visit the page
    cy.visit('/wizard/catalog');
  });

  it('Validates the search bar functionality', () => {
    cy.get('input[placeholder="Search"]').as('searchBar');
    cy.get('button').contains('Clear').as('clearButton');

    const allCardsContainer =
      '#root > div > main > article > .MuiGrid-container > .MuiGrid-root > :nth-child(2) > div';

    // All cards should be visible before searching
    // Currently there are 3 cards available. Update the length when more cards are added
    cy.get(allCardsContainer).should('have.length', 3);

    cy.get('@searchBar').type('wizard');
    cy.get('@searchBar').should('have.value', 'wizard');

    // Only one card, i.e the Wizard use cases card should be visible after searching
    cy.get(allCardsContainer)
      .should('have.length', 1)
      .then($card => {
        cy.wrap($card)
          .find('.MuiCardHeader-root')
          .should('contain.text', 'Create wizard use cases');
      });

    cy.get('@clearButton').click();
    cy.get('@searchBar').should('have.value', '');

    // Negative Scenario for search functionality
    cy.get('@searchBar').type('random-string');
    cy.get('@searchBar').should('have.value', 'random-string');

    // No cards should be visible after random search.
    cy.get(allCardsContainer).should('have.length', 0);

    cy.get('@clearButton').click();
    cy.get('@searchBar').should('have.value', '');
  });

  it('Validates the Domain dropdown options', () => {
    cy.get('[aria-labelledby="domain-select-label"]').click();
    cy.get('li[aria-selected="true"]').should('contain.text', 'All');

    const domainOptions = [
      'All',
      'AAP Operations',
      'Intermediate',
      'Network',
      'Windows',
      'RHEL',
    ];

    domainOptions.forEach(option => {
      cy.get('li').should('contain.text', option);
    });

    const allCardsContainer =
      '#root > div > main > article > .MuiGrid-container > .MuiGrid-root > :nth-child(2) > div';

    // All cards should be visible before option selection
    // Currently there are 3 cards available. Update the length when more cards are added
    cy.get(allCardsContainer).should('have.length', 3);

    cy.contains('li', 'AAP Operations').click();
    cy.get('[aria-labelledby="domain-select-label"]').should(
      'contain.text',
      'AAP Operations',
    );

    // Only one card, i.e the Wizard use cases card should be visible after selection
    cy.get(allCardsContainer)
      .should('have.length', 1)
      .then($card => {
        cy.wrap($card)
          .find('.MuiCardHeader-root')
          .should('contain.text', 'Create wizard use cases');
      });

    cy.get('button').contains('Clear all').as('clearButton');
    cy.get('@clearButton').click();

    cy.get('[aria-labelledby="domain-select-label"]').should(
      'contain.text',
      'All',
    );
  });

  it('Validates and toggles Wizard and Service checkboxes', () => {
    const checkboxNames = ['wizard', 'service'];

    checkboxNames.forEach(name => {
      cy.get(`input[name="${name}"]`).as('checkbox');

      cy.get('@checkbox').should('be.checked');

      cy.get('@checkbox').uncheck();
      cy.get('@checkbox').should('not.be.checked');

      cy.get('@checkbox').check();
      cy.get('@checkbox').should('be.checked');
    });
  });

  it('Validates the Owner dropdown options', () => {
    cy.get(
      '.MuiGrid-container > .MuiGrid-root > form > :nth-child(3) > .MuiInputBase-root',
    ).click();
    cy.get('li[aria-selected="true"]').should('contain.text', 'All');

    const ownerOptions = ['All', 'RedHat'];

    ownerOptions.forEach(option => {
      cy.get('li').should('contain.text', option);
    });

    const allCardsContainer =
      '#root > div > main > article > .MuiGrid-container > .MuiGrid-root > :nth-child(2) > div';

    // All cards should be visible before option selection
    // Currently there are 3 cards available. Update the length when more cards are added
    cy.get(allCardsContainer).should('have.length', 3);

    cy.contains('li', 'RedHat').click();
    cy.get(
      '.MuiGrid-container > .MuiGrid-root > form > :nth-child(3) > .MuiInputBase-root',
    ).should('contain.text', 'RedHat');

    // Only one card, i.e the Wizard use cases card should be visible after selection
    cy.get(allCardsContainer)
      .should('have.length', 1)
      .then($card => {
        cy.wrap($card)
          .find('.MuiCardHeader-root')
          .should('contain.text', 'Create wizard use cases');
      });

    cy.get('button').contains('Clear all').as('clearButton');
    cy.get('@clearButton').click();

    cy.get(
      '.MuiGrid-container > .MuiGrid-root > form > :nth-child(3) > .MuiInputBase-root',
    ).should('contain.text', 'All');
  });

  it('Validates the Choose button functionality and their corresponding destination URLs on each card', () => {
    function testCardNavigation(index, expectedUrls) {
      if (index >= expectedUrls.length) return;

      cy.get(
        `:nth-child(${index + 1}) > .MuiPaper-root > .MuiCardActions-root > .MuiBox-root > .MuiButtonBase-root`,
      ).click();
      cy.url().should('include', expectedUrls[index]);

      cy.go('back');
      cy.wait(500);

      testCardNavigation(index + 1, expectedUrls);
    }

    const expectedUrls = [
      '/wizard/catalog/create-task/default/ansible-collection-template',
      '/wizard/catalog/create-task/default/ansible-playbook-template',
      '/wizard/catalog/create-task/default/generic-seed',
    ];

    testCardNavigation(0, expectedUrls);
  });

  it('Validates the Add to favorites button functionality', () => {
    const allCardsContainer =
      '#root > div > main > article > .MuiGrid-container > :nth-child(2) > :nth-child(2)';
    const favoritesContainer =
      '#root > div > main > article > .MuiGrid-container > :nth-child(2) > :nth-child(1)';

    const cardTitle = 'Create Ansible Collection Project';

    cy.get(allCardsContainer).contains(cardTitle).should('exist');

    cy.get(favoritesContainer).contains(cardTitle).should('not.exist');

    cy.get(allCardsContainer)
      .contains(cardTitle)
      .parents('.MuiCard-root')
      .find('button[aria-label="add to favorites"]')
      .click();

    cy.get(favoritesContainer).contains(cardTitle).should('exist');

    cy.get(allCardsContainer).contains(cardTitle).should('not.exist');

    // Remove from favorites
    cy.get(favoritesContainer)
      .contains(cardTitle)
      .parents('.MuiCard-root')
      .find('button[aria-label="add to favorites"]')
      .click();
  });
});
