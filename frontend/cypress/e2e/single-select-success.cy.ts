describe('happy path for file upload', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage, uploads file, views the graph, clicks graph node, and tests that side panel functions correctly', () => {
    
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
    
    // click on node in network graph page
    cy.window().then((win: any) => {
        const { nodes, setSelectedNodeId } = win.__STORE__.getState()
        expect(nodes.length, "Graph has at least one node").to.be.greaterThan(0)
        setSelectedNodeId(nodes[0].id)
    })

    // check side panel appears
    cy.contains("Node Data", { timeout: 10000 }).should("be.visible")

    // click node data drop down
    cy.contains("Node Data").click()

    // Check connections and computed attributes dropdown are visible
    cy.contains("Connections").should("be.visible")
    cy.contains("Computed Attributes").should("be.visible")

    // click connections drop down
    cy.contains('[data-slot="accordion-trigger"]', 'Connections')
        .scrollIntoView()
        .should('be.visible')
        .click()

    // click on sort button in connections dropdown
    cy.get('[data-slot="accordion-content"]')
        .contains('button', 'Sort')
        .should('be.visible')
        .click()

    // click on sort by low to high button
    cy.get('[data-slot="dropdown-menu-content"]')
        .should('be.visible')
        .contains('[data-slot="dropdown-menu-radio-item"]', 'Size (Low to High)')
        .click()
    
    // make sure incoming connections tab exists
    cy.contains('[data-slot="tabs-trigger"]', 'Incoming').click()

    // click on a node from the incoming connections list
    cy.get('[data-slot="tabs-content"][data-state="active"]')
        .find('div.group.cursor-pointer')
        .first()
        .should('be.visible')
        .click()


    // check that the side panel updates to the new node
    cy.contains("Node Data").should("be.visible")
    cy.contains("Connections").should("be.visible")
    cy.contains("Computed Attributes").should("be.visible")

    // click on back button in side panel
    cy.contains('button', 'BACK').click()

    // collapse Connections dropdown if open
    cy.contains('[data-slot="accordion-trigger"]', 'Connections')
        .click()

    // make sure side panel goes back to the previous node
    cy.contains("Node Data").should("be.visible")
    cy.contains("Connections").should("be.visible")
    cy.contains("Computed Attributes").should("be.visible")

    // close side panel
    cy.get('button[title="Close details"]')
        .should('be.visible')
        .click()
    
    // check side panel is closed
    cy.contains("Node Data").should("not.exist")

});
});