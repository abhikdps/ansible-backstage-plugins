import { authenticator } from 'otplib';
export class Common {
  static LogintoGithub() {
    cy.visit('https://github.com/login');
    cy.contains('Sign in').then(() => {
      cy.get('#login_field').type(Cypress.env('GH_USER_ID'));
      cy.get('#password').type(Cypress.env('GH_USER_PASS'), { log: false });
      cy.get('[value="Sign in"]').click();
      // Enable 2FA
      cy.get('#app_totp').type(
        authenticator.generate(Cypress.env('AUTHENTICATOR_SECRET')),
        { log: false },
      );
    });
  }
}
