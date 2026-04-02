describe('happy path for semantic search', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage, file is uploaded, graph successfully shows, and search bar is able to search for nodes using advanced/ semantic search', () => {
    
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

    // check graph is uploaded / visible
    cy.contains('a', 'Network Graph').click()
    cy.get('canvas').should('be.visible')

    // todo: complete rest of test here when semantic search is implemented

  });
});