const algoX = {

  mkDataMap: grid => Immutable.Map({
    grid: grid,
    inputGrid: grid,
    state: algoX.mkStateMap(grid),
    moves: Immutable.List(),
  }),

  // Generate a map that holds all the information needed to represent a given grid
  // and the progress in finding a solution
  mkStateMap: grid => {
    // Lookup Table for using rows to find the [i,j,v] they represent
    const mkLookup = grid => {
      const gMatrix = grid.get("matrix")
      const symbols = grid.get("symbols")
      // Create maps of matrix row to grid coords and value for easy lookup
      return Immutable.Map().withMutations(mutable => {
        for (let i=0; i<gMatrix.count(); i++) {
          for (let j=0; j<gMatrix.count(); j++) {
            // Using ecMatrix row index as key
            symbols.forEach(v => {
              const row = exactCover.getRowIndex(i, j, v, grid)
              mutable.set(row, Immutable.Map({"i":i, "j":j, "v":v}))
            })
          }
        }
      })
    } // End mkLookup
    // Generate set of rows that represent cells that have already been filled in the grid
    const initSolution = grid => {
      const gMatrix = grid.get("matrix")
      const symbols = grid.get("symbols")
      return Immutable.Set().withMutations(mutable => {
        for (let i=0; i<gMatrix.count(); i++) {
          for (let j=0; j<gMatrix.count(); j++) {
            const v = gMatrix.getIn([i,j])
            if (v != " ") {
              // If value exists, then it is part of the solution
              const row = exactCover.getRowIndex(i, j, v, grid)
              mutable.add(row)
            }
          }
        }
      })
    } // End initSolution
    // Generate set of rows that can be added to the solution
    const initOpen = grid => {
      const gMatrix = grid.get("matrix")
      const symbols = grid.get("symbols")
      return Immutable.Set().withMutations(mutable => {
        for (let i=0; i<gMatrix.count(); i++) {
          for (let j=0; j<gMatrix.count(); j++) {
            const v = gMatrix.getIn([i,j]);
            if (v == " ") {
              // If value doesn't exist, then the cell is open
              symbols.forEach(s => {
                const row = exactCover.getRowIndex(i, j, s, grid)
                mutable.add(row)
              })
            }
          }
        }
      })
    } // End initOpen
    // Generate set of col indices that are already satisfied by the solution
    const initSatisfied = (solution, ecMatrix) => {
      return Immutable.Set().withMutations(mutable => {
        solution.forEach(row => ecMatrix.get(row).forEach((state, col) => { 
          if(state>0) mutable.add(col)
        }))
      })
    } // End initSatisfied

    const state = {}
    state.ecMatrix = exactCover.mkMatrix(grid)
    state.lookup = mkLookup(grid)
    state.solution = initSolution(grid)
    state.open = initOpen(grid)
    state.satisfied = initSatisfied(state.solution, state.ecMatrix)

    return Immutable.Map(state)
  }, // End mkDataMap

  solveStep: data => { // Depth first search using Algorithm X
    const moves = data.get("moves")
    const state = data.get("state")

    if(algoX.solutionFound(data)) return data.setIn(["grid","isComplete"], true)
    else {
      const newMoves = moves.concat(algoX.getNext(state))
      return data.withMutations(mutable => {
        mutable.set("state", newMoves.last())
        mutable.set("grid", algoX.updateGrid(newMoves.last(), data.get("inputGrid")))
        mutable.set("moves", newMoves.pop())
      })
    }
  },

  // Impure Iterative Solver
  solve: grid => {
    let data = algoX.mkDataMap(grid)
    // Loop until solution found or exhausted all options
    while(!algoX.isFinished(data)) {
      data = algoX.solveStep(data)
    }
    return data.get("grid")
  },
  // Update the grid to represent the current solution
  updateGrid: (state, grid) => {
    return grid.set("matrix", grid.get("matrix").withMutations(mutable => {
      state.get("solution").forEach(row => {
        const s = state.get("lookup").get(row)
        // If statement not strictly needed, just want to prevent overriding original input cells
        // to make possible bugs more obvious
        if(mutable.getIn([s.get("i"), s.get("j")])==" ") {
          mutable.setIn([s.get("i"), s.get("j")], s.get("v"))
        }
      })
    }))
  },
  // Either a solution has been found, or there are no more open rows
  isFinished: data => data.getIn(["grid","isComplete"]) || data.getIn(["state","open"]).count()<=0,
  // Is solution found once all constraints are satisfied, which happens to be the number of columns in the ecMatrix
  solutionFound: data => data.getIn(["state","satisfied"]).count() == data.getIn(["state","ecMatrix",0]).count(),
  // Get a list of states that follow the current given state
  getNext: state => {
    const col = algoX.getUnsatisfiedCol(state)
    const candidates = col>=0 ? algoX.getCandidates(state, col) : Immutable.Set()
    // Subtract both valid and invalid candidates so that states following this will not 
    // have to process candidates already shown to be invalid
    const nextState = state.set("open", state.get("open").subtract(candidates))
    return candidates
      .filter(c => algoX.rowIsValid(nextState, c)) // filter for valid candidates
      .map(c => nextState.withMutations(stateMutable => { // For each candidate,
        // Add to solution,
        stateMutable.set("solution", nextState.get("solution").add(c)) 
        // Add cols that candidate satisfies to satisfied set.
        stateMutable.set("satisfied", nextState.get("satisfied").union(algoX.getSatisfiedCols(nextState, c)))
      }))
      .toList()
  },
  // Get a list of rows that satisfy a given column
  getCandidates: (state, col) => state.get("open").filter(row => state.getIn(["ecMatrix", row]).get(col)>0),
  // If the row does not satisfy any cols that have already been satisfied (no intersection), then it is valid
  rowIsValid: (state, row) => state.get("satisfied").intersect(algoX.getSatisfiedCols(state, row)).count()<=0,
  // Make a list of column indices that the row satisfies
  getSatisfiedCols: (state, row) => state.get("ecMatrix").get(row).map((s,i) => s>0 ? i : -1).filter(col => col>=0),
  // Find a column that is not satisfied by the solution
  getUnsatisfiedCol: state => { 
    for (let i=0; i<state.getIn(["ecMatrix", 0]).count(); i++) {
      if(!state.get("satisfied").has(i)) return i;
    }
    return -1;
  },
}