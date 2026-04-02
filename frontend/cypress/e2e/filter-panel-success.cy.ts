describe('happy path for filter panel', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
  })

  it('loads the homepage, upload file, go to network graph page, click on filter panel, and tests successful interactions for filtering', () => {
    
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

    // check filter icon is there + click (ie. funnel icon next to multi-select toggle)
    cy.get('button[title="Graph filters"]').should('be.visible').click()
    cy.contains('span', 'Graph Filters').should('be.visible')

    // type 'surveillance' into the filter panel search bar + click enter
    cy.get('#graph-filter-panel').within(() => {
        cy.get('#filter-combined-keyword')
            .should('be.visible')
            .type('surveillance{enter}')

        // check we have a new tag with 'surveillance' (ie. the search term)
        cy.contains('span', 'surveillance').should('be.visible')
    })

    // get the 'surveillance' tag + it's colour (ie. should be blue when first entered in search bar)
    cy.contains('span', 'surveillance')
        .should('be.visible')
        .as('surveillanceTag')

    cy.get('@surveillanceTag')
        .invoke('attr', 'class')
        .should('include', 'bg-blue-500/10')
    
    // click on the tag
    cy.get('@surveillanceTag').click()

    // check if the colour of the tag changed (ie. tag colours rotate between blue -> purple -> red)
    cy.get('@surveillanceTag')
        .invoke('attr', 'class')
        .should('include', 'bg-purple-500/10')
    
    // click on drop down in filter panel 
    cy.get('#graph-filter-panel').within(() => {
        cy.get('button[title="Split into separate name and description filters"]')
            .should('be.visible')
            .click()

        // check that we have 2 search bars now (one for searching node name, one for searching node description)
        cy.contains('div', 'Node name contains').should('be.visible')
        cy.contains('div', 'Description contains').should('be.visible')
    })

    // type 'data' in the description search bar + click enter
    cy.get('#graph-filter-panel').within(() => {
        cy.get('#filter-description-keyword')
            .should('be.visible')
            .type('data{enter}')
            
        // check we have a new tag with 'data' (ie. the search term)
        cy.contains('span', 'data').should('be.visible')
    })

    // click on 'x' next to the 'data' tag to remove it from the descriptions search bar
    cy.get('#graph-filter-panel').within(() => {
        cy.contains('div', 'Description contains')
            .parent()
            .within(() => {
            cy.contains('span', 'data')
                .should('be.visible')
                .within(() => {
                cy.get('button').click()
            })

        // check the 'data' tag is not there anymore
        cy.contains('span', 'data').should('not.exist')
        })
    })

    // close the dropdown in the filter panel
    cy.get('#graph-filter-panel').within(() => {
        cy.get('button[title="Combine name and description into one filter"]')
            .should('be.visible')
            .click()

        // check that we only have 1 search bar again
        cy.get('#filter-combined-keyword').should('be.visible')
        cy.contains('div', 'Node name contains').should('not.exist')
    })

    // click on slider in filter panel
    cy.get('#graph-filter-panel').within(() => {
        cy.get('#filter-min-importance')
            .should('be.visible')
            .then($el => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 
                    'value'
                )?.set;

                if (nativeInputValueSetter) {
                    // slide the bar to 90%
                    nativeInputValueSetter.call($el[0], 0.9);
                    $el[0].dispatchEvent(new Event('input', { bubbles: true }));
                }
            })

        // check that the 'ALL' label changes to '>= 90%'
        cy.contains('span', '≥ 90%').should('be.visible')
    })

    // click on the 'reset' btn in the filter panel
    cy.get('#graph-filter-panel').within(() => {
        cy.get('button[title="Reset all filters"]')
            .should('be.visible')
            .click()

        // check all filters are cleared
        cy.contains('span', 'All').should('be.visible')
        cy.get('#filter-combined-keyword').should('have.value', '')
    })

    // click on 'x' to close the filter panel
    cy.get('button[title="Graph filters"]')
        .should('be.visible')
        .click()

    // check filter panel is closed
    cy.contains('span', 'Graph Filters').should('not.exist') 
  });
});