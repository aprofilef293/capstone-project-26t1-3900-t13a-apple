/*  Integration tests for semantic (advanced) search and search results
 *  Main Contributors: Lucy
 */

describe('happy path for semantic search', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
    cy.intercept('GET', '/api/graph/semantic-search*').as('semanticSearch')
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

    // check that an 'advanced' btn exists and click it
    cy.contains('button', 'Advanced').click()

    // click on search bar and type 'organism' + click enter
    cy.get('input[placeholder="Search for semantic matches"]')
      .as('searchInput')
      .click()
      .type('organism')
    cy.wait(500)
    cy.get('@searchInput').type('{enter}')
    
    // wait for the search results 
    cy.wait('@semanticSearch', { timeout: 120000 })

    // check for search results side panel + query string is visible
    cy.contains('h2', 'Search Results', { timeout: 10000 }).should('be.visible')
    cy.contains(/Query:\s*organism/i).should('be.visible')

    cy.contains('h2', 'Search Results')
      .parent()
      .parent()
      .parent()
      .as('searchPanel')

    // click 'x' btn to close results panel
    cy.get('@searchPanel')
      .within(() => {
        cy.get('button[title="Close details"]').click()
      })
    
    // check that panel is closed
    cy.contains('h2', 'Search Results').should('not.exist')
  });
});