describe('OBO Explorer App', () => {
  it('loads the homepage and displays the title', () => {
    cy.visit('http://localhost:5173');
    cy.contains('OBO Explorer');
  });
});