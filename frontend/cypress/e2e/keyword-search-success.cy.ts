describe('happy path for keyword search', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage, file is uploaded, graph successfully shows, and search bar is able to search for nodes', () => {
    
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

    // click search bar + type "organism" (ie. search term)
    cy.get('input[placeholder="Search for exact words or phrases"]').as('searchInput')
    cy.get('@searchInput').click().type('organism', { delay: 80 })

    // check dropdown appears under searchbar + has suggested matching nodes/ terms
    cy.contains('button', /organism/i, { timeout: 10000 }).should('be.visible')

    // press enter key on keyboard
    cy.get('@searchInput').type('{enter}')

    // check for side panel for search results appear
    cy.contains('h2', 'Search Results', { timeout: 10000 }).should('be.visible')
    cy.contains(/Query:\s*organism/i).should('be.visible')

    // click on first search result in result panel
    cy.contains('h2', 'Search Results')
        .parent()
        .parent()
        .parent()
        .as('searchPanel')
    
    // check search results panel have nodes (ie. at least 1 node so the panel isn't empty)
    cy.get('@searchPanel')
        .find('div.cursor-pointer')
        .should('have.length.greaterThan', 0)

    // get the first search result
    cy.get('@searchPanel')
        .find('div.cursor-pointer')
        .first()
        .as('firstResult')

    // click on the first search result
    cy.get('@firstResult')
        .should('be.visible')
        .click()

    // make sure side panel appears with the clicked node's info
    cy.contains("Node Data", { timeout: 10000 }).should("be.visible")

    // click on 'x' to close side panel
    cy.get('button[title="Close details"]').should('be.visible').click()

    // check that side panel is closed
    cy.contains('Node Data').should('not.exist')

    // click on the 'x' in the search bar
    cy.get('@searchInput')
        .closest('div.relative')
        .find('button:has(svg.lucide-x)')
        .should('be.visible')
        .click()
  });
});