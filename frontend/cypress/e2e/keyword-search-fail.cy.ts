describe('happy path for keyword search', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage, file is uploaded, graph successfully shows, and search bar shows error message when search terms cannot be found', () => {
    
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

    // click search bar + type "@@@" (ie. search term)
    cy.get('input[placeholder="Search nodes..."]').as('searchInput')
    cy.get('@searchInput').click().type('@@@', { delay: 80 })

    // check dropdown appears under searchbar + has message for no matching nodes
    cy.contains('No quick matches for "@@@". Please try Advanced Search.').should('be.visible')
  });
});