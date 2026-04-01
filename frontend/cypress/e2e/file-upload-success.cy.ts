describe('happy path for file upload', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage and file is successfully uploaded', () => {
    
    // go to homepage
    cy.visit('http://localhost:5173')
    cy.contains('OBO Explorer').should('be.visible')

    // upload file
    cy.get('input[type="file"]').first().selectFile(
      'cypress/fixtures/Small OWL.owl',
      { force: true }
    )

    cy.url().should('include', '/manager')

    // wait for file to upload
    cy.wait('@uploadOntology', { timeout: 120000 })
    cy.wait('@fetchGraph', { timeout: 120000 })

    // check that upload file is successful
    cy.contains('Import Status').should('be.visible')
    cy.contains('Complete', { timeout: 120000 }).should('be.visible')
  });
});