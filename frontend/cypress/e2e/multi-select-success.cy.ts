export {};

type PickedNodes = {
  firstId: string;
  firstLabel: string;
  secondId: string;
  secondLabel: string;
}

type GraphNode = {
  id: string;
  label: string;
};

type AppStoreState = {
  nodes: GraphNode[];
  toggleNodeSelection: (id: string) => void;
};

type StoreWindow = Window & {
  __STORE__?: {
    getState: () => AppStoreState;
  };
};

const getStoreState = (win: Window): AppStoreState => {
  const store = (win as unknown as StoreWindow).__STORE__;
  if (!store) {
    throw new Error("__STORE__ should be available");
  }
  return store.getState();
};

describe('happy path for multi-select', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ontology/upload').as('uploadOntology')
    cy.intercept('GET', '/api/graph/**').as('fetchGraph')
    cy.intercept('GET', '/api/graph/paths*').as('fetchPaths')
  })

  it('loads the homepage, upload file, go to network graph page, click on multi-select toggle, and test multi-select features', () => {
    
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

    // pick which nodes from the graph we want to click first
    cy.window().then((win) => {
      const state = getStoreState(win);
      expect(state.nodes.length).to.be.greaterThan(1);

      const first = state.nodes[0];
      const second = state.nodes[1];

      cy.wrap({
        firstId: first.id,
        firstLabel: first.label,
        secondId: second.id,
        secondLabel: second.label,
      }).as("pickedNodes");
    });

    // click on multi-select toggle swithc
    cy.get('[aria-label="Toggle multi-select mode"]')
        .should('have.attr', 'data-state', 'unchecked')
        .click()
        .should('have.attr', 'data-state', 'checked')

        // click first node in graph 
        cy.get("@pickedNodes").then((p) => {
          const picked = p as unknown as PickedNodes;
          cy.window().then((win) => {
            getStoreState(win).toggleNodeSelection(picked.firstId);
          });
        });

    // check multi-select side panel appears 
    cy.contains('h2', 'Selected Nodes', { timeout: 10000 }).should('be.visible')
    
    // check we have the correct node clicked
    cy.get("@pickedNodes").then((p) => {
      const picked = p as unknown as PickedNodes;
      cy.contains("span", picked.firstLabel).should("be.visible");
    });

    // check we havethe select attribute dropdown + the clear selection button in the side panel 
    cy.contains('button', 'Select attribute').should('be.visible')
    cy.get('button[title="Clear selection"]').should('be.visible')

    // click second node
    cy.get("@pickedNodes").then((p) => {
      const picked = p as unknown as PickedNodes;
      cy.window().then((win) => {
        getStoreState(win).toggleNodeSelection(picked.secondId);
      });
    });

    // wait for the paths to appear on graph
    cy.wait('@fetchPaths', { timeout: 5000 }) 

    // check side panel has both selected nodes
    cy.contains('h2', 'Path between Nodes', { timeout: 10000 }).should('be.visible')
    cy.get("@pickedNodes").then((p) => {
      const picked = p as unknown as PickedNodes;
      cy.contains("span", picked.firstLabel).should("exist");
      cy.contains("span", picked.secondLabel).should("exist");
    });

    // check the pathview btn is on the screen + click
    cy.contains('button', 'Path View').should('be.visible').click()

    // click the select attribute dropdown + click the 'colour' field
    cy.contains('button', 'Select attribute').click()
    cy.contains('[data-slot="dropdown-menu-radio-item"]', 'colour').click()

    // check that each card on the multi-select side panel have a 'colour' field
    cy.contains(/colour:/i).should('be.visible')

    // click on attribute dropdown + click the 'colour' field again
    cy.contains('h2', 'Path between Nodes')
      .closest('aside')
      .within(() => {
        cy.contains('button', /^colour$/).should('be.visible').click();
      });
    cy.contains('[data-slot="dropdown-menu-radio-item"]', /^colour$/)
      .should('be.visible')
      .click({ force: true });

    // check that the dropdown goes back to showing 'select attribute'
    cy.contains('button', 'Select attribute').should('be.visible')

    // click any card in side panel
    cy.get("@pickedNodes").then((p) => {
      const picked = p as unknown as PickedNodes;
      cy.contains("span", picked.firstLabel).click();
    });

    // check that we're back in single-select mode
    cy.get('[aria-label="Toggle multi-select mode"]').should('have.attr', 'data-state', 'unchecked')

    // check the side panel has details for the clicked node
    cy.contains('Node Data', { timeout: 10000 }).should('be.visible')
    cy.get("@pickedNodes").then((p) => {
      const picked = p as unknown as PickedNodes;
      cy.contains("h2", picked.firstLabel).should("be.visible");
    });

    // click the multi-select toggle swithc again to go back to multi-select mode
    cy.get('[aria-label="Toggle multi-select mode"]')
        .click()
        .should('have.attr', 'data-state', 'checked')
    
    // check that the side panel is the multi-select one (ie. there should be a select attribute dropdown and a clear selection button)
    cy.contains('button', 'Select attribute').should('be.visible')
    // also click the clear selection button
    cy.get('button[title="Clear selection"]').should('be.visible').click()

    // check that multi-select side panel is not there anymore
    cy.contains('button', 'Select attribute').should('not.exist')

    // click the multi-select toggle to go back to single select mode 
    cy.get('[aria-label="Toggle multi-select mode"]')
        .click()
        .should('have.attr', 'data-state', 'unchecked');
  });
});