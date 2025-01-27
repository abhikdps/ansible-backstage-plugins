describe('Portal Tests', () => {
  it('Login to AAP', () => {
    cy.visit('/');
    cy.contains('Sign In').then(() => {
      cy.contains('Sign In').invoke('removeAttr', 'target').click();
      cy.get('#pf-login-username-id').type(Cypress.env('AAP_USER_ID'));
      cy.get('#pf-login-password-id').type(Cypress.env('AAP_USER_PASS'), {
        log: false,
      });
      cy.get(
        '#app > div > div > main > div.pf-v5-c-login__main-body > form > div.pf-v5-c-form__group.pf-m-action > div > div > button',
      ).click();
      cy.wait(3000);
    });
  });

  it('Go to wizard catalog plugin', () => {
    cy.visit('/wizard');
  });
});
