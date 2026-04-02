describe('happy path for hierarchy panel', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
        if (
        err.message.includes('Sigma: could not find a suitable program for node type "circle"')
        ) {
        return false
        }
    })
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage, upload file, goes to heirarchy panel and tests successful interactions', () => {
    
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

    // go to network graph page
    cy.contains('a', 'Network Graph').click()
    cy.get('canvas').should('be.visible')

    // click on heirarchy
    cy.contains('button', 'Hierarchy').should('be.visible').click()
    
    // wait for it to load
    cy.contains('Data Ontology Hierarchy', { timeout: 2000 }).should('be.visible')

    // get the first folder in heirarchy page
    cy.get('svg.lucide-folder')
        .first()
        .closest('div[style*="padding-left"]')
        .as('firstFolderRow')
    
    // click on the chevron arrow to expand the folder
    cy.get('@firstFolderRow')
        .find('svg.lucide-chevron-right, svg.lucide-chevron-down')
        .first()
        .click({ force: true })

    // click the first node inside the expanded folder
    cy.get('@firstFolderRow')
        .parent()
        .children('div.mt-1')
        .should('be.visible')
        .find('div[style*="padding-left"]')
        .first()
        .click({ force: true })
    
    // check side panel appears
    cy.contains("Node Data", { timeout: 1000 }).should("be.visible")

    // close side panel
    cy.get('button[title="Close details"]')
        .should('be.visible')
        .click()
    
    // check side panel is closed
    cy.contains("Node Data").should("not.exist")

    // click on graph button
    cy.contains('button', 'Graph').should('be.visible').click()

    // check that the graph appears again
    cy.get('canvas').should('be.visible')
  });
});