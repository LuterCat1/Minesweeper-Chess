/********** Global Setup **********/
const game = new Chess();
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');

let selectedSquare = null;
let legalMoves = [];
let playAgainstBot = false; // default: Two Players mode

// Mapping for chess pieces to Unicode symbols.
const pieceUnicode = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};


/*************NEW GAME FUNCTION **************/
function newgame(){
    window.location.reload()
}


/********** Minesweeper Setup **********/
// Minesweeper applies to squares on ranks 3–6.
const MINE_PROBABILITY = 0.25; // 25% chance
const minesData = {};    // For each square: { mine: true } OR { mine: false, number: X }
const revealedData = {}; // Tracks which minesweeper squares (e.g. "d4") have been revealed.
function isMinesweeperSquare(square) {
  const rank = parseInt(square[1]);
  return rank >= 3 && rank <= 6;
}
function generateMinesData() {
  const files = 'abcdefgh';
  const ranks = '3456';
  for (let f of files) {
    for (let r of ranks) {
      const square = f + r;
      const isMine = Math.random() < MINE_PROBABILITY;
      minesData[square] = { mine: isMine };
    }
  }
  // For safe squares, compute adjacent mine count.
  for (let f of files) {
    for (let r of ranks) {
      const square = f + r;
      if (!minesData[square].mine) {
        let count = 0;
        for (let df = -1; df <= 1; df++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (df === 0 && dr === 0) continue;
            const fileIndex = files.indexOf(f) + df;
            const rankNum = parseInt(r) + dr;
            if (fileIndex >= 0 && fileIndex < 8 && rankNum >= 3 && rankNum <= 6) {
              const neighbor = files[fileIndex] + rankNum;
              if (minesData[neighbor] && minesData[neighbor].mine) count++;
            }
          }
        }
        minesData[square].number = count;
      }
    }
  }
}
generateMinesData();

/********** Helper: King Presence Check **********/
function isKingAlive(chessGame, color) {
  const board = chessGame.board();
  for (let row of board) {
    for (let piece of row) {
      if (piece && piece.type === 'k' && piece.color === color) {
        return true;
      }
    }
  }
  return false;
}

/********** Helper: Remove Piece at a Square **********/
// Updates the FEN of the given game instance to remove a piece at a square.
function removePieceAtFromGame(chessGame, square) {
  const fen = chessGame.fen();
  const parts = fen.split(' ');
  let boardFen = parts[0].split('/'); // rows from rank8 to rank1
  const file = square[0];
  const rank = parseInt(square[1]);
  const rowIndex = 8 - rank;
  const colIndex = 'abcdefgh'.indexOf(file);
  // Expand FEN row (e.g. "3p4" → "   p    ")
  function expandFenRow(row) {
    let expanded = "";
    for (let char of row) {
      if (isNaN(char)) expanded += char;
      else expanded += " ".repeat(parseInt(char));
    }
    return expanded;
  }
  // Compress expanded row back to FEN format.
  function compressFenRow(expanded) {
    let newRow = "";
    let count = 0;
    for (let char of expanded) {
      if (char === " ") count++;
      else {
        if (count > 0) { newRow += count; count = 0; }
        newRow += char;
      }
    }
    if (count > 0) newRow += count;
    return newRow;
  }
  let expandedRow = expandFenRow(boardFen[rowIndex]);
  expandedRow = expandedRow.substring(0, colIndex) + " " + expandedRow.substring(colIndex + 1);
  boardFen[rowIndex] = compressFenRow(expandedRow);
  parts[0] = boardFen.join('/');
  const newFen = parts.join(' ');
  chessGame.load(newFen);
}

/********** Board Rendering **********/
function renderBoard() {
    boardElement.innerHTML = '';
    const boardState = game.board(); // 8x8 array; row 0 = rank8, row 7 = rank1.
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const squareDiv = document.createElement('div');
        squareDiv.classList.add('square');
        const isLight = ((i + j) % 2 === 0);
        squareDiv.classList.add(isLight ? 'light' : 'dark');
        const file = 'abcdefgh'[j];
        const rank = 8 - i;
        const squareName = file + rank;
        squareDiv.dataset.square = squareName;
        const piece = boardState[i][j];
        
        if (piece) {
          const color = piece.color === 'w' ? 'w' : 'b';
          const type = piece.type.toUpperCase();
          const pieceImg = document.createElement('img');
          pieceImg.classList.add('piece');
          pieceImg.src = `img/${color}${type}.png`;
          squareDiv.appendChild(pieceImg);
        }
  
        if (isMinesweeperSquare(squareName) && revealedData[squareName]) {
          const infoSpan = document.createElement('span');
          infoSpan.classList.add('mines-info');
          if (minesData[squareName] && minesData[squareName].mine) {
            infoSpan.textContent = "💣";
          } else {
            const num = minesData[squareName] ? minesData[squareName].number : 0;
            infoSpan.textContent = num > 0 ? num : "";
          }
          squareDiv.appendChild(infoSpan);
        }
        squareDiv.addEventListener('click', onSquareClick);
        boardElement.appendChild(squareDiv);
      }
    }
  }

/********** Event Handling **********/
function onSquareClick(e) {
  // In Bot mode, prevent moves when it's not the human's turn.
  if (playAgainstBot && game.turn() === 'b') return;
  const squareDiv = e.currentTarget;
  const squareName = squareDiv.dataset.square;
  // If clicking a highlighted legal move square, attempt the move.
  if (legalMoves.includes(squareName) && selectedSquare) {
    const move = game.move({ from: selectedSquare, to: squareName, promotion: 'q' });
    if (move) {
      processMinesweeper(move);
      clearHighlights();
      selectedSquare = null;
      legalMoves = [];
      renderBoard();
      updateStatus();
      if (playAgainstBot && game.turn() === 'b') {
        setTimeout(botMove, 500);
      }
      return;
    }
  }
  // Otherwise, if clicking on a piece belonging to the current turn, select it.
  const piece = game.get(squareName);
  if (piece && piece.color === game.turn()) {
    clearHighlights();
    selectedSquare = squareName;
    squareDiv.classList.add('highlight');
    legalMoves = game.moves({ square: squareName, verbose: true }).map(m => m.to);
    highlightSquares(legalMoves);
  } else {
    clearHighlights();
    selectedSquare = null;
    legalMoves = [];
  }
}
function highlightSquares(squares) {
  document.querySelectorAll('.square').forEach(sq => {
    if (squares.includes(sq.dataset.square)) {
      sq.classList.add('highlight');
    }
  });
}
function clearHighlights() {
  document.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('highlight');
  });
}

/********** Process Minesweeper Effects **********/
function processMinesweeper(move) {
  if (isMinesweeperSquare(move.to)) {
    if (!revealedData[move.to]) {
      revealedData[move.to] = true;
      if (minesData[move.to] && minesData[move.to].mine) {
        // Remove the piece silently.
        removePieceAtFromGame(game, move.to);
      }
    }
  }
}

/********** Evaluation & Minimax for Bot **********/
// Helper: Check if king is alive in a given game instance.
function isKingAliveInGame(chessGame, color) {
  return isKingAlive(chessGame, color);
}

// Basic evaluation based on material—and if a king is missing, assign an extreme value.
function evaluateBoard(chessGame) {
  if (!isKingAliveInGame(chessGame, 'w')) return -1000000;
  if (!isKingAliveInGame(chessGame, 'b')) return 1000000;
  const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  let score = 0;
  const board = chessGame.board();
  for (let row of board) {
    for (let piece of row) {
      if (piece) {
        const val = values[piece.type];
        score += (piece.color === 'w' ? val : -val);
      }
    }
  }
  return score;
}

// Minimax search with alpha-beta pruning.
function minimax(chessGame, depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || chessGame.game_over()) {
    return { score: evaluateBoard(chessGame) };
  }
  let bestMove = null;
  const moves = chessGame.moves({ verbose: true });
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (let move of moves) {
      const clone = new Chess(chessGame.fen());
      const executedMove = clone.move({ from: move.from, to: move.to, promotion: 'q' });
      // Simulate mines effect on the clone.
      if (executedMove && isMinesweeperSquare(executedMove.to) &&
          !revealedData[executedMove.to] && minesData[executedMove.to] && minesData[executedMove.to].mine) {
        removePieceAtFromGame(clone, executedMove.to);
      }
      const evalResult = minimax(clone, depth - 1, alpha, beta, false).score;
      if (evalResult > maxEval) {
        maxEval = evalResult;
        bestMove = move;
      }
      alpha = Math.max(alpha, evalResult);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      const clone = new Chess(chessGame.fen());
      const executedMove = clone.move({ from: move.from, to: move.to, promotion: 'q' });
      if (executedMove && isMinesweeperSquare(executedMove.to) &&
          !revealedData[executedMove.to] && minesData[executedMove.to] && minesData[executedMove.to].mine) {
        removePieceAtFromGame(clone, executedMove.to);
      }
      const evalResult = minimax(clone, depth - 1, alpha, beta, true).score;
      if (evalResult < minEval) {
        minEval = evalResult;
        bestMove = move;
      }
      beta = Math.min(beta, evalResult);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

/********** Bot Move Logic **********/
function botMove() {
  if (!playAgainstBot || game.turn() !== 'b') return;
  const result = minimax(game, 3, -Infinity, Infinity, false);
  if (result.move) {
    const move = game.move({ from: result.move.from, to: result.move.to, promotion: 'q' });
    if (move) {
      processMinesweeper(move);
      renderBoard();
      updateStatus();
    }
  }
}

/********** Status Update **********/
function updateStatus() {
  let status = "";
  // First, check if a king is missing.
  if (!isKingAlive(game, 'w')) {
    status = "Game over: White king is blown. Black wins!";
  } else if (!isKingAlive(game, 'b')) {
    status = "Game over: Black king is blown. White wins!";
  } else if (game.in_checkmate()) {
    const turnColor = game.turn() === 'w' ? 'White' : 'Black';
    status = `Game over: ${turnColor} is in checkmate.`;
  } else if (game.in_draw()) {
    status = "Game over: Draw.";
  } else {
    const turnColor = game.turn() === 'w' ? 'White' : 'Black';
    status = `${turnColor} to move.`;
    if (game.in_check()) {
      status += ` ${turnColor} is in check!`;
    }
  }
  statusElement.textContent = status;
}

/********** Mode Selection **********/
document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', function() {
    playAgainstBot = (this.value === 'bot');
    game.reset();
    // Clear any revealed mines data.
    for (let key in revealedData) delete revealedData[key];
    renderBoard();
    updateStatus();
  });
});

/********** Initialize **********/
renderBoard();
updateStatus();
