describe("additional small ui feature checks", () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173')
  });

  it("toggle between light and dark mode", () => {
    cy.contains("span", "Toggle theme")
        .parent("button")
        .click();

    cy.get("html").should("not.have.class", "dark"); 

    cy.contains("span", "Toggle theme")
        .parent("button")
        .click();

    cy.get("html").should("have.class", "dark");
  });

  it("left side bar collapse and expand", () => {
    cy.contains("OBO Explorer").should("be.visible");

    // collapse button (chevron-left when expanded)
    cy.get("button svg.lucide-chevron-left").closest("button").click();
    cy.contains("OBO Explorer").should("not.exist");

    // expand button (chevron-right when collapsed)
    cy.get("button svg.lucide-chevron-right").closest("button").click();
    cy.contains("OBO Explorer").should("be.visible");
  });
});