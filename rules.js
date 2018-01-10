// TODO: Graphical effect for capture
// TODO: Graphical state for completion-oriented restarts
var rules;
(function (rules) {
    var maybe = function (x, y) {
        return x == null ? y() : x;
    };
    var Layer = (function () {
        function Layer(size, tileBuilder) {
            this.size = size;
            this.contents = [];
            for (var x = 0; x < size.x; x++) {
                var col = [];
                for (var y = 0; y < size.y; y++) {
                    col.push(tileBuilder(new Vec2(x, y)));
                }
                this.contents.push(col);
            }
        }
        Layer.prototype.get = function (b) {
            if (!this.isValidVector(b)) {
                return null;
            }
            return this.contents[b.x][b.y];
        };
        Layer.prototype.unsafeSet = function (b, newTile) {
            this.contents[b.x][b.y] = newTile;
        };
        Layer.prototype.isValidVector = function (b) {
            var size = this.size;
            return b.x >= 0 && b.y >= 0 && b.x < size.x && b.y < size.y;
        };
        Layer.prototype.recreate = function (tileBuilder) {
            return new Layer(this.size, tileBuilder);
        };
        Layer.duplicate = function (layer, cloneTile) {
            if (layer == null) {
                return null;
            }
            return new Layer(Vec2.duplicate(layer.size), function (pos) { return cloneTile(layer.get(pos)); });
        };
        Layer.eq = function (l1, l2, teq) {
            if (!Vec2.eq(l1.size, l2.size)) {
                return false;
            }
            var size = l1.size;
            for (var x = 0; x < size.x; x++) {
                for (var y = 0; y < size.y; y++) {
                    var vec = new Vec2(x, y);
                    if (!teq(l1.get(vec), l2.get(vec))) {
                        return false;
                    }
                }
            }
            return true;
        };
        return Layer;
    }());
    rules.Layer = Layer;
    var Vec2 = (function () {
        function Vec2(x, y) {
            this.x = x;
            this.y = y;
        }
        Vec2.prototype.neighbors = function (includeSelf) {
            if (includeSelf === void 0) { includeSelf = false; }
            return ([new Vec2(this.x + 1, this.y),
                new Vec2(this.x, this.y + 1),
                new Vec2(this.x - 1, this.y),
                new Vec2(this.x, this.y - 1)
            ]);
        };
        Vec2.duplicate = function (vec) {
            return new Vec2(vec.x, vec.y);
        };
        Vec2.eq = function (v1, v2) {
            return v1.x == v2.x && v1.y == v2.y;
        };
        return Vec2;
    }());
    rules.Vec2 = Vec2;
    var Pie = (function () {
        function Pie(cur, orig) {
            this.current = cur;
            this.original = orig;
        }
        Pie.deplete = function (pie) {
            if (pie == null) {
                return null;
            }
            var pie2 = Pie.duplicate(pie);
            pie2.current--;
            return pie2;
        };
        // pie-updater that does not alter the pie
        Pie.ignore = function (pie) {
            return pie;
        };
        Pie.undeplete = function (pie) {
            if (pie == null) {
                return null;
            }
            var pie2 = Pie.duplicate(pie);
            pie2.current++;
            pie2.original++;
            return pie2;
        };
        Pie.duplicate = function (pie) {
            if (pie == null) {
                return null;
            }
            return new Pie(pie.current, pie.original);
        };
        Pie.mayMove = function (pie) {
            return !(pie != null && pie.current == 0);
        };
        Pie.ignoreMayMove = function (pie) {
            return true;
        };
        return Pie;
    }());
    rules.Pie = Pie;
    (function (Player) {
        Player[Player["Black"] = 0] = "Black";
        Player[Player["White"] = 1] = "White";
    })(rules.Player || (rules.Player = {}));
    var Player = rules.Player;
    ;
    var Players = (function () {
        function Players() {
        }
        Players.eq = function (p1, p2) {
            return p1 == p2;
        };
        Players.opposite = function (p) {
            if (p == null) {
                throw "the null player has no opposite";
            }
            if (p == Player.Black) {
                return Player.White;
            }
            return Player.Black;
        };
        return Players;
    }());
    rules.Players = Players;
    (function (BoardFailureReason) {
        BoardFailureReason[BoardFailureReason["BadPosition"] = 0] = "BadPosition";
        BoardFailureReason[BoardFailureReason["AlreadyPlayed"] = 1] = "AlreadyPlayed";
        BoardFailureReason[BoardFailureReason["PieEmpty"] = 2] = "PieEmpty";
        BoardFailureReason[BoardFailureReason["DuplicateBoard"] = 3] = "DuplicateBoard";
    })(rules.BoardFailureReason || (rules.BoardFailureReason = {}));
    var BoardFailureReason = rules.BoardFailureReason;
    var Board = (function () {
        function Board(title, size, nextPlayer, owners, pies) {
            if (nextPlayer === void 0) { nextPlayer = Player.Black; }
            if (owners === void 0) { owners = null; }
            if (pies === void 0) { pies = null; }
            this.title = title;
            this.size = size;
            this.nextPlayer = nextPlayer;
            this.owners = maybe(owners, function () { return new Layer(size, function (b) { return null; }); });
            this.pies = maybe(pies, function () { return new Layer(size, function (b) { return null; }); });
            // owners && / pies && -- only run these checks when the param was actually provided
            if (owners && !Vec2.eq(this.owners.size, size)) {
                throw "invalidly-sized owners layer";
            }
            if (pies && !Vec2.eq(this.pies.size, size)) {
                throw "invalidly-sized pies layer";
            }
        }
        Board.fromBuilder = function (title, size, nextPlayer, builder) {
            if (nextPlayer === void 0) { nextPlayer = Player.Black; }
            var owners = new Layer(size, function (v) { return builder(v)[0]; });
            var pies = new Layer(size, function (v) { return builder(v)[1]; });
            return new Board(title, size, nextPlayer, owners, pies);
        };
        Board.duplicate = function (board) {
            return new Board(board.title, board.size, board.nextPlayer, Layer.duplicate(board.owners, function (i) { return i; }), Layer.duplicate(board.pies, function (i) { return Pie.duplicate(i); }));
        };
        // TODO: Tool this out for level generation mode, where playing on a pie adds one instead of taking one.
        Board.play = function (board, pos, mayMove, pieFn) {
            if (mayMove === void 0) { mayMove = rules.Pie.mayMove; }
            if (pieFn === void 0) { pieFn = rules.Pie.deplete; }
            var player = board.nextPlayer;
            if (!board.pies.isValidVector(pos)) {
                return BoardFailureReason.BadPosition;
            }
            var pie = board.pies.get(pos);
            if (!mayMove(pie)) {
                return BoardFailureReason.PieEmpty;
            }
            var existing = board.owners.get(pos);
            if (existing != null) {
                return BoardFailureReason.AlreadyPlayed;
            }
            var board2 = Board.duplicate(board);
            board2.owners.unsafeSet(pos, player);
            board2.pies.unsafeSet(pos, pieFn(board2.pies.get(pos)));
            var killOwners = board2.owners;
            [Players.opposite(player), player].forEach(function (playerToConsider) {
                // try all neighbors.
                pos.neighbors().concat([pos]).forEach(function (vec) {
                    killOwners = Board.tryToKill(killOwners, playerToConsider, vec);
                });
            });
            board2.owners = killOwners;
            if (Layer.eq(board2.owners, board.owners, Players.eq)) {
                return BoardFailureReason.DuplicateBoard;
            }
            board2.nextPlayer = Players.opposite(board.nextPlayer);
            return board2;
        };
        Board.tryToKill = function (killBoard, playerToKill, killFrom) {
            return Board.tryToKill_(killBoard, playerToKill, [killFrom]);
        };
        Board.tryToKill_ = function (killBoard, playerToKill, toExplore) {
            var explored = [];
            var groupMembers = [];
            var _loop_1 = function() {
                var killFrom = toExplore.pop();
                if (!killBoard.isValidVector(killFrom)) {
                    return "continue";
                }
                if (!explored.every(function (v) { return !Vec2.eq(v, killFrom); })) {
                    return "continue";
                } // don't look at the same one twice
                explored.push(killFrom);
                var existing = killBoard.get(killFrom);
                if (existing == Players.opposite(playerToKill)) {
                    return "continue";
                }
                // if we escaped
                if (existing == null) {
                    return { value: killBoard };
                }
                // only remaining possibility: it's the player we want to kill
                // add to our group if not already there
                if (groupMembers.every(function (v) { return !Vec2.eq(v, killFrom); })) {
                    groupMembers.push(killFrom);
                    // look for liberties by neighbors
                    killFrom.neighbors().forEach(function (neighbor) {
                        // add neighbor to unexplored if not already there
                        if (toExplore.every(function (v) { return !Vec2.eq(v, neighbor); })) {
                            ;
                            toExplore.push(neighbor);
                        }
                    });
                }
            };
            while (toExplore.length != 0) {
                var state_1 = _loop_1();
                if (typeof state_1 === "object") return state_1.value;
                if (state_1 === "continue") continue;
            }
            if (groupMembers.length == 0) {
                return killBoard;
            } // nothing to kill, so don't kill!
            var killBoard2 = Layer.duplicate(killBoard, function (player) { return player; });
            groupMembers.forEach(function (vec) { return killBoard2.unsafeSet(vec, null); });
            return killBoard2;
        };
        Board.prototype.spec = function (name) {
            var boardParts = [];
            for (var y = 0; y < this.size.y; y++) {
                var boardPart = [];
                for (var x = 0; x < this.size.x; x++) {
                    var vec = new rules.Vec2(x, y);
                    var cell = "";
                    var owner = this.owners.get(vec);
                    var pie = this.pies.get(vec);
                    if (pie == null) {
                        cell += "-";
                    }
                    else {
                        cell += pie.original;
                    }
                    if (owner == null) {
                        cell += "-";
                    }
                    else {
                        cell += (owner == Player.Black ? "B" : "W");
                    }
                    boardPart.push(cell);
                }
                boardParts.push("  " + JSON.stringify(boardPart));
            }
            return "boardBuilding.loadBoard(" + JSON.stringify(name) + ",\n" +
                boardParts.join(",\n") + "\n" +
                ")";
        };
        return Board;
    }());
    rules.Board = Board;
})(rules || (rules = {}));
var gen;
(function (gen) {
    var Difficulty = (function () {
        function Difficulty(fdiff, ddiff, pexc, pmp, pzp, pnp) {
            this.factionDiff = fdiff;
            this.destructionDiff = ddiff;
            this.pieExcitement = pexc;
            this.pruneMaxPercent = pmp;
            this.pruneZeroPercent = pzp;
            this.pruneNonzeroPercent = pnp;
        }
        // TODO: There's a range of personality not being explored with the negated versions of these contstnats
        Difficulty.Easy = new Difficulty(2, 2, -2, 0.5, 0.7, 0.5);
        Difficulty.Medium = new Difficulty(2, -2, 0.8, 0.4, 0.7, 0.3);
        // probably at least one difficulty should go in-between
        // hard is no-fucking-around super hard
        // easy should erase fewer holes
        // medium varies from easy to tricky
        Difficulty.Hard = new Difficulty(4, 8, 8, 0.5, 0.7, 0.2);
        return Difficulty;
    }());
    gen.Difficulty = Difficulty;
    var Generator = (function () {
        function Generator() {
        }
        Generator.generate = function (size, difficulty) {
            if (difficulty === void 0) { difficulty = Difficulty.Medium; }
            var baseBoard = Generator.mostPromising(size, [new rules.Board("RNG", size)], Generator.scoreInit, function (_) { return true; }, rules.Pie.ignoreMayMove, rules.Pie.ignore);
            for (var x = 0; x < size.x; x++) {
                for (var y = 0; y < size.y; y++) {
                    baseBoard.pies.unsafeSet(new rules.Vec2(x, y), new rules.Pie(0, 0));
                }
            }
            var solvedBoard = Generator.mostPromising(size, [baseBoard], Generator.scoreMove(difficulty), function (board) { return Generator.playablePieExcitement(board) > 0; }, rules.Pie.ignoreMayMove, rules.Pie.undeplete);
            var count = Math.floor(difficulty.pruneZeroPercent * size.x * size.y);
            for (var x = 0; x < size.x; x++) {
                for (var y = 0; y < size.y; y++) {
                    if (count <= 0) {
                        break;
                    }
                    if (solvedBoard.pies.get(new rules.Vec2(x, y)).original == 0 && Math.random() < difficulty.pruneZeroPercent) {
                        solvedBoard.pies.unsafeSet(new rules.Vec2(x, y), null);
                        count--;
                    }
                }
            }
            for (var x = 0; x < size.x; x++) {
                for (var y = 0; y < size.y; y++) {
                    if (count <= 0) {
                        break;
                    }
                    var v = new rules.Vec2(x, y);
                    var existing = solvedBoard.pies.get(v);
                    if (Math.random() < difficulty.pruneNonzeroPercent && existing != null && existing.current <= 1) {
                        solvedBoard.pies.unsafeSet(v, null);
                        if (Generator.playablePieExcitement(solvedBoard) <= 0) {
                            solvedBoard.pies.unsafeSet(new rules.Vec2(x, y), null);
                        }
                        else {
                            count--;
                        }
                    }
                }
            }
            var finalPuzzle = rules.Board.duplicate(baseBoard);
            finalPuzzle.pies = solvedBoard.pies;
            if (finalPuzzle.nextPlayer == rules.Player.White) {
                finalPuzzle.nextPlayer = rules.Player.Black;
                for (var x = 0; x < size.x; x++) {
                    for (var y = 0; y < size.y; y++) {
                        var vec = new rules.Vec2(x, y);
                        var owner = finalPuzzle.owners.get(vec);
                        if (owner != null) {
                            finalPuzzle.owners.unsafeSet(vec, rules.Players.opposite(owner));
                        }
                    }
                }
            }
            console.log("RNG puzzle: \n" + finalPuzzle.spec("RNG"));
            return finalPuzzle;
        };
        Generator.mostPromising = function (size, toConsiderBase, score, isValid, mayMove, deplete) {
            var failures = 0;
            var toConsider = toConsiderBase.map(function (i) { return { score: 0, board: i }; });
            // 700 for 3 * 5
            // 700 / 15 ~= 47
            var _loop_2 = function() {
                if (toConsider.length == 0) {
                    throw "cannot pick boards with no boards to pick from";
                }
                var toConsider2 = toConsider.filter(function (i) { return isValid(i.board); });
                toConsider.forEach(function (pre) {
                    var preBoard = pre.board;
                    var maybeBoard = rules.Board.play(preBoard, new rules.Vec2(Math.floor(preBoard.size.x * Math.random()), Math.floor(preBoard.size.y * Math.random())), mayMove, deplete);
                    if (maybeBoard.constructor != rules.Board) {
                        failures++;
                        return;
                    }
                    var actualBoard = maybeBoard;
                    if (!isValid(actualBoard)) {
                        return;
                    }
                    toConsider2.push({ score: -score(actualBoard, preBoard, pre.score), board: actualBoard });
                    return;
                });
                // equal scores are arbitrarily ordered
                Generator.shuffle(toConsider2);
                toConsider2.sort(function (a, b) { if (a.score > b.score)
                    return 1;
                else if (a.score < b.score)
                    return -1;
                else
                    return 0; });
                if (toConsider2.length == 0) {
                    failures++;
                }
                else {
                    toConsider = toConsider2.slice(0, 15);
                }
                failures++;
            };
            while (failures < 47 * size.x * size.y) {
                _loop_2();
            }
            return toConsider[0].board;
        };
        Generator.scoreMove = function (difficulty) {
            return function (now, previous, lastScore) {
                var nowCount = Generator.pieceCount(now);
                var previousCount = Generator.pieceCount(previous);
                var diff = -Math.abs(Generator.pieceCount(now, rules.Player.Black) -
                    Generator.pieceCount(now, rules.Player.White));
                // let playableSpots = Generator.countPlayable(now);
                var playablePieExcitement = Generator.playablePieExcitement(now);
                var newPart = diff * difficulty.factionDiff
                    + Math.abs(nowCount - previousCount) * difficulty.destructionDiff
                    + playablePieExcitement * difficulty.pieExcitement;
                return newPart + lastScore * 0.50;
            };
        };
        Generator.scoreInit = function (now, previous, lastScore) {
            return -Math.abs(Generator.pieceCount(now, rules.Player.Black) -
                Generator.pieceCount(now, rules.Player.White));
        };
        Generator.pieceCount = function (board, which) {
            if (which === void 0) { which = null; }
            var count = 0;
            for (var x = 0; x < board.size.x; x++) {
                for (var y = 0; y < board.size.y; y++) {
                    var owner = board.owners.get(new rules.Vec2(x, y));
                    if ((owner != null) || (which != null && owner == which)) {
                        count++;
                    }
                }
            }
            return count;
        };
        Generator.countPlayable = function (board) {
            var playableCount = 0;
            for (var x = 0; x < board.size.x; x++) {
                for (var y = 0; y < board.size.y; y++) {
                    if (rules.Board.play(board, new rules.Vec2(x, y)).constructor == rules.Board) {
                        playableCount++;
                    }
                }
            }
            return playableCount;
        };
        Generator.playablePieExcitement = function (board) {
            var count = 0;
            for (var x = 0; x < board.size.x; x++) {
                for (var y = 0; y < board.size.y; y++) {
                    var pie = board.pies.get(new rules.Vec2(x, y));
                    if (pie != null) {
                        count += Math.pow(pie.original, 2);
                    } // Math.pow(pie.original, 3) - 1; }
                }
            }
            return count;
        };
        Generator.shuffle = function (array) {
            var i = 0, j = 0, temp = null;
            for (i = array.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1));
                temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
        };
        return Generator;
    }());
    gen.Generator = Generator;
})(gen || (gen = {}));
var uiModel;
(function (uiModel) {
    var Schemes = (function () {
        function Schemes() {
        }
        Schemes.forPlayerState = function (player, completeState) {
            var scheme;
            if (player == rules.Player.White) {
                scheme = {
                    colorBg: "#000",
                    strokeBlankSpot: "#333",
                    strokeOuterBorder: "#222",
                    fillPieSlice: "#04f",
                    strokePieSlice: "#04f",
                    strokeDeadPieSlice: "#bb0",
                    strokeBlack: "#fff",
                    fillBlack: "#000",
                    strokeWhite: "#fff",
                    fillWhite: "#fff",
                    strokeFriendEdge: "#444",
                    strokeEnemyEdge: "#04f"
                };
            }
            else if (player == rules.Player.Black) {
                scheme = {
                    colorBg: "#fff",
                    strokeBlankSpot: "#ddd",
                    strokeOuterBorder: "#eee",
                    fillPieSlice: "#f40",
                    strokePieSlice: "#f40",
                    strokeDeadPieSlice: "#bb0",
                    strokeBlack: "#000",
                    fillBlack: "#000",
                    strokeWhite: "#000",
                    fillWhite: "#fff",
                    strokeFriendEdge: "#ddd",
                    strokeEnemyEdge: "#f40"
                };
            }
            else {
                throw "no scheme for the null player";
            }
            if (completeState != CompleteState.NotCompleted) {
                scheme.strokeBlankSpot = scheme.strokeDeadPieSlice;
                scheme.strokeBlack = "#fff";
                scheme.fillBlack = "#000";
                scheme.strokeWhite = "#000";
                scheme.fillWhite = "#fff";
                if (completeState == CompleteState.Succeeded) {
                    scheme.strokeOuterBorder = "#ee4";
                    scheme.colorBg = "#ee4";
                }
                if (completeState == CompleteState.Failed) {
                    scheme.strokeBlack = "#f99";
                    scheme.strokeOuterBorder = "#f40";
                    scheme.strokePieSlice = "#ff0";
                    scheme.strokeDeadPieSlice = "#000";
                    scheme.colorBg = "#f40";
                }
                scheme.strokeEnemyEdge = scheme.strokeWhite;
                scheme.strokeFriendEdge = scheme.strokeWhite;
            }
            return scheme;
        };
        return Schemes;
    }());
    uiModel.Schemes = Schemes;
    var TileState = (function () {
        function TileState() {
            this.mousedOver = false;
            this.diesNextTurn = false;
            this.unplayableReason = null;
            this.blowUp = 1.0;
            this.jitterX = 0;
            this.bounceY = 0;
            this.bounceDy = 0;
        }
        TileState.prototype.mouseOver = function () {
            this.mousedOver = true;
        };
        TileState.prototype.mouseOut = function () {
            this.mousedOver = false;
        };
        TileState.prototype.markUnplayableReason = function (reason) {
            this.unplayableReason = reason;
        };
        TileState.prototype.advance = function () {
            // update distances and stuff
            var blowUpTarget;
            var mayBounce = false;
            if (this.mousedOver && this.unplayableReason == null) {
                blowUpTarget = 1.5;
                mayBounce = true;
            }
            else {
                blowUpTarget = 1.0;
            }
            if (this.mousedOver && this.unplayableReason != null) {
                switch (this.unplayableReason) {
                    case rules.BoardFailureReason.PieEmpty:
                        this.jitterX = (2 * (Math.random() - 0.5)) / 100;
                        break;
                    case rules.BoardFailureReason.DuplicateBoard:
                        blowUpTarget = 0.5;
                        break;
                    case rules.BoardFailureReason.AlreadyPlayed:
                    case rules.BoardFailureReason.BadPosition:
                }
            }
            if (mayBounce) {
                if (this.bounceGoingUp) {
                    this.bounceDy = -0.1;
                }
                else {
                    this.bounceDy += 0.01;
                }
                this.bounceY += this.bounceDy;
                if (this.bounceY <= -0.5) {
                    this.bounceY = -0.5;
                    this.bounceGoingUp = false;
                }
                else if (this.bounceY >= 0.5) {
                    this.bounceY = 0.5;
                    this.bounceDy = 0;
                    this.bounceGoingUp = true;
                }
            }
            else {
                this.bounceY = 0;
            }
            if (this.blowUp > blowUpTarget) {
                this.blowUp -= .1;
            }
            if (this.blowUp < blowUpTarget) {
                this.blowUp += .1;
            }
            if (Math.abs(this.blowUp - blowUpTarget) == 0) {
                this.blowUp = blowUpTarget;
            }
        };
        return TileState;
    }());
    uiModel.TileState = TileState;
    (function (CompleteState) {
        CompleteState[CompleteState["NotCompleted"] = 0] = "NotCompleted";
        CompleteState[CompleteState["Succeeded"] = 1] = "Succeeded";
        CompleteState[CompleteState["Failed"] = 2] = "Failed";
    })(uiModel.CompleteState || (uiModel.CompleteState = {}));
    var CompleteState = uiModel.CompleteState;
    // designed around being mutated
    var UiModel = (function () {
        function UiModel(board) {
            this.current = board;
            this.previous = board;
            this.tileStates = new rules.Layer(board.size, function (b) { return new TileState(); });
            this.completeState = this.checkCompleteState();
            this.uiGlobals = {
                clipCenter: new rules.Vec2(0.5, 0.5),
                clipSize: 1,
                completedTicks: 0,
            };
        }
        UiModel.prototype.checkCompleteState = function () {
            var anyNotFilled = false;
            for (var x = 0; x < this.current.size.x; x++) {
                for (var y = 0; y < this.current.size.y; y++) {
                    var pie = this.current.pies.get(new rules.Vec2(x, y));
                    if (pie == null) {
                        continue;
                    }
                    if (pie.current == 0) {
                        continue;
                    }
                    anyNotFilled = true;
                    break;
                }
            }
            var anyPlayable = false;
            if (this.tileStates) {
                for (var x = 0; x < this.current.size.x; x++) {
                    for (var y = 0; y < this.current.size.y; y++) {
                        var ts = this.tileStates.get(new rules.Vec2(x, y));
                        if (ts.unplayableReason != null) {
                            continue;
                        }
                        anyPlayable = true;
                        break;
                    }
                }
            }
            if (anyNotFilled) {
                if (anyPlayable) {
                    return CompleteState.NotCompleted;
                }
                return CompleteState.Failed;
            }
            return CompleteState.Succeeded;
        };
        UiModel.prototype.update = function (message) {
            // TODO: pass time difference too
            if (message == "Tick") {
                this.advanceTileStates();
                this.advanceUIGlobals();
            }
            else if (message[0] == "MouseOver") {
                var mouseVec = message[1];
                if (this.completeState != CompleteState.NotCompleted) {
                    return;
                }
                this.recalculateTileStates(mouseVec);
            }
            else if (message[0] == "Click") {
                if (this.completeState != CompleteState.NotCompleted) {
                    return;
                }
                var cellVec = message[1];
                var percentVec = message[2];
                var possibleNext = rules.Board.play(this.current, cellVec);
                if (possibleNext.constructor != rules.Board) {
                    // not playable: maybe in the future, announce
                    return;
                }
                this.uiGlobals.clipCenter = percentVec;
                this.uiGlobals.clipSize = 0.05;
                this.previous = this.current;
                this.current = possibleNext;
                {
                    // hack to make it so that the transition between board states is more seamless
                    this.previous = rules.Board.duplicate(this.previous);
                    this.previous.owners.unsafeSet(cellVec, this.current.owners.get(cellVec));
                }
                this.recalculateTileStates(cellVec);
                this.completeState = this.checkCompleteState();
            }
        };
        UiModel.prototype.recalculateTileStates = function (mouseVec) {
            var _this = this;
            // now that we know what's playable, determine what dies
            var hypotheticalBoard = this.current;
            var hpBoard2 = rules.Board.play(this.current, mouseVec);
            if (hpBoard2.constructor == rules.Board) {
                hypotheticalBoard = hpBoard2;
            }
            this.tileStates = this.tileStates.recreate(function (v) {
                // use mutability: this is super unsafe
                var ts = _this.tileStates.get(v);
                // don't acknowledge mouseover if completed
                if (_this.completeState == CompleteState.NotCompleted && !ts.mousedOver && rules.Vec2.eq(v, mouseVec)) {
                    ts.mouseOver();
                }
                // assume mouse-out if completed
                if (ts.mousedOver && (_this.completeState != CompleteState.NotCompleted || !rules.Vec2.eq(v, mouseVec))) {
                    ts.mouseOut();
                }
                // don't display unplayable if completed
                if (_this.completeState == CompleteState.NotCompleted) {
                    ts.markUnplayableReason(_this.unplayableReason(v));
                }
                ts.diesNextTurn =
                    ((_this.current.owners.get(v) != null ||
                        (ts.mousedOver && (ts.unplayableReason == rules.BoardFailureReason.DuplicateBoard || ts.unplayableReason == null)))
                        && hypotheticalBoard.owners.get(v) == null);
                return ts;
            });
        };
        // null if playable
        UiModel.prototype.unplayableReason = function (v) {
            var reason;
            if ((reason = rules.Board.play(this.current, v)).constructor == rules.Board) {
                return null;
            }
            return reason;
        };
        UiModel.prototype.advanceTileStates = function () {
            var _this = this;
            this.tileStates = this.tileStates.recreate(function (v) {
                // so unsafe!!!
                var ts = _this.tileStates.get(v);
                ts.advance();
                return ts;
            });
        };
        UiModel.prototype.advanceUIGlobals = function () {
            if (this.completeState != CompleteState.NotCompleted) {
                this.uiGlobals.completedTicks++;
            }
            this.uiGlobals.clipSize *= 1.12;
            if (this.uiGlobals.clipSize > 1.0) {
                this.uiGlobals.clipSize = 1.0;
            }
        };
        return UiModel;
    }());
    uiModel.UiModel = UiModel;
    var DrawParts = (function () {
        function DrawParts(main) {
            this.canvas = main;
            this.newCanvas = document.createElement("canvas");
            this.newCanvas.width = this.canvas.width;
            this.newCanvas.height = this.canvas.height;
            this.sizeRatio = this.canvas.getBoundingClientRect().width / this.canvas.width;
        }
        return DrawParts;
    }());
    uiModel.DrawParts = DrawParts;
    var View = (function () {
        function View() {
        }
        View.view = function (ui, d) {
            d.canvas.getContext("2d").lineWidth = 0.8 / d.sizeRatio;
            d.newCanvas.getContext("2d").lineWidth = 0.8 / d.sizeRatio;
            // == old canvas ==
            d.canvas.getContext("2d").clearRect(0, 0, d.newCanvas.width, d.newCanvas.height);
            View.drawBoard(ui, CompleteState.NotCompleted, ui.previous, d.canvas.getContext("2d"), d.canvas.width, d.canvas.height);
            // == new canvas ==
            var newCtx = d.newCanvas.getContext("2d");
            newCtx.clearRect(0, 0, d.newCanvas.width, d.newCanvas.height);
            newCtx.save();
            var layout = new Layout(new rules.Vec2(d.newCanvas.width, d.newCanvas.height), ui.previous.size);
            var usableDim = layout.usableDimensions();
            var clipCenterAbsX = ui.uiGlobals.clipCenter.x * layout.pixelSize.x;
            var clipCenterAbsY = ui.uiGlobals.clipCenter.y * layout.pixelSize.y;
            var clipCenterAbsR = ui.uiGlobals.clipSize *
                Math.sqrt(Math.pow(layout.pixelSize.x, 2) + Math.pow(layout.pixelSize.y, 2));
            newCtx.moveTo(clipCenterAbsX, clipCenterAbsY);
            newCtx.beginPath();
            newCtx.arc(clipCenterAbsX, clipCenterAbsY, clipCenterAbsR, 0, 2 * Math.PI);
            newCtx.clip();
            View.drawBoard(ui, ui.completeState, ui.current, newCtx, d.newCanvas.width, d.newCanvas.height);
            // == new onto old ==
            newCtx.restore();
            d.canvas.getContext("2d").drawImage(d.newCanvas, 0, 0);
        };
        View.drawBoard = function (ui, completeState, board, con, canvasWidth, canvasHeight) {
            // TODO: Do something with completedTicks
            var tileStates = ui.tileStates;
            var player = board.nextPlayer;
            var scheme = Schemes.forPlayerState(player, completeState);
            con.moveTo(0, 0);
            con.beginPath();
            con.rect(0, 0, canvasWidth, canvasHeight);
            con.fillStyle = scheme.colorBg;
            con.fill();
            con.closePath();
            var layout = new Layout(new rules.Vec2(canvasWidth, canvasHeight), board.size);
            // draw border
            {
                var udim = layout.usableDimensions();
                var cornerR = 0.1 * Math.min(udim.size.x, udim.size.y);
                var edgeFudge = 0.01 * Math.min(udim.size.x, udim.size.y);
                var x1 = udim.corner.x + edgeFudge;
                var y1 = udim.corner.y + edgeFudge;
                var x2 = udim.corner.x + udim.size.x - edgeFudge;
                var y2 = udim.corner.y + udim.size.y - edgeFudge;
                var xm = (x1 + x2) / 2;
                var ym = (y1 + y2) / 2;
                con.beginPath();
                con.moveTo(xm, y1);
                con.arcTo(x2, y1, x2, ym, cornerR);
                con.arcTo(x2, y2, xm, y2, cornerR);
                con.arcTo(x1, y2, x1, ym, cornerR);
                con.arcTo(x1, y1, xm, y1, cornerR);
                con.arcTo(x2, y1, x2, ym, cornerR);
                con.strokeStyle = scheme.strokeOuterBorder;
                con.stroke();
                con.closePath();
            }
            for (var x = 0; x < board.size.x; x++) {
                for (var y = 0; y < board.size.y; y++) {
                    var dimensions = layout.toCellDimensions(new rules.Vec2(x, y));
                    View.drawTile(ui, board, player, scheme, View.specAt(new rules.Vec2(x, y), ui, board, player), dimensions.corner.x, dimensions.corner.y, dimensions.size.x, dimensions.size.y, con);
                }
            }
            document.title = board.title;
        };
        View.specAt = function (vec, ui, board, player) {
            var pie = board.pies.get(vec);
            var owner = board.owners.get(vec);
            var tileState = ui.tileStates.get(vec);
            // pretend to be owned by the player if the player is mousing over it and it may be played
            if (tileState != null) {
                if ((tileState.unplayableReason == null ||
                    // allow "duplicate board" to appear in order to show players the error of their ways
                    tileState.unplayableReason == rules.BoardFailureReason.DuplicateBoard) && tileState.mousedOver) {
                    owner = player;
                }
            }
            return { vec: vec, pie: pie, owner: owner, tileState: tileState };
        };
        View.drawTile = function (ui, board, player, scheme, me, x, y, w, h, con) {
            var FULL_ARC = Math.PI * 2;
            var xmid = x + w / 2;
            var ymid = y + h / 2;
            var r = Math.min(w, h) / 2;
            r *= me.tileState.blowUp;
            var pieR = r * 0.65;
            var pieOrbR = r * 0.10;
            var ownerR = r * 0.25;
            // draw edges
            if (me.owner != null) {
                [[[1, 0], [w, 0]],
                    [[0, -1], [0, -h]],
                    [[-1, 0], [-w, 0]],
                    [[0, 1], [0, h]]
                ].forEach(function (_a) {
                    var _b = _a[0], celXOff = _b[0], celYOff = _b[1], _c = _a[1], pxXOff = _c[0], pxYOff = _c[1];
                    var celNeighbor = new rules.Vec2(me.vec.x + celXOff, me.vec.y + celYOff);
                    var pxNeighborX = xmid + pxXOff;
                    var pxNeighborY = ymid + pxYOff;
                    var neighbor = View.specAt(celNeighbor, ui, board, player);
                    var edgeR = r * 0.35;
                    var neighborEdgeR;
                    if (neighbor.tileState == null) {
                        neighborEdgeR = edgeR / me.tileState.blowUp;
                    }
                    else {
                        neighborEdgeR = edgeR / me.tileState.blowUp * neighbor.tileState.blowUp;
                    }
                    // assume neighbor has no blowup
                    // TODO: Use a unique scheme color here
                    if (neighbor.owner == me.owner) {
                        // note: the stone on either side strokes the same line here
                        var baseAng_1 = Math.atan2(pxYOff, pxXOff);
                        if (me.tileState.diesNextTurn) {
                            con.strokeStyle = scheme.strokePieSlice;
                        }
                        else {
                            con.strokeStyle = scheme.strokeFriendEdge;
                        }
                        [-Math.PI / 4, Math.PI / 4].forEach(function (angOff) {
                            var angMe = baseAng_1 + angOff;
                            var angNeighbor = (baseAng_1 + Math.PI) - angOff;
                            var xNear = xmid + Math.cos(angMe) * edgeR;
                            var yNear = ymid + Math.sin(angMe) * edgeR;
                            var xFar = pxNeighborX + Math.cos(angNeighbor) * neighborEdgeR;
                            var yFar = pxNeighborY + Math.sin(angNeighbor) * neighborEdgeR;
                            var xMid = (xNear + xFar) / 2;
                            var yMid = (yNear + yFar) / 2;
                            con.beginPath();
                            con.moveTo(xNear, yNear);
                            con.lineTo(xMid, yMid);
                            con.stroke();
                            con.closePath();
                        });
                    }
                    // TODO: and here
                    if (neighbor.owner == rules.Players.opposite(me.owner) || neighbor.tileState == null) {
                        var directionNeighbor = Math.atan2(pxNeighborY - ymid, pxNeighborX - xmid);
                        con.strokeStyle = scheme.strokeEnemyEdge;
                        con.moveTo(xmid, ymid);
                        con.beginPath();
                        con.arc(xmid, ymid, edgeR, directionNeighbor - Math.PI / 4, directionNeighbor + Math.PI / 4, false);
                        con.stroke();
                        con.closePath();
                    }
                });
            }
            if (me.pie != null) {
                for (var slice = 0; slice < me.pie.original; slice++) {
                    var sliceFull = slice >= me.pie.current;
                    var circXMid = xmid + Math.cos((slice + 1) / me.pie.original * FULL_ARC + Math.PI / 2) * pieR;
                    var circYMid = ymid - Math.sin((slice + 1) / me.pie.original * FULL_ARC + Math.PI / 2) * pieR;
                    circXMid += me.tileState.jitterX * w;
                    if (me.pie.current > 0) {
                        con.strokeStyle = scheme.strokePieSlice;
                        if (sliceFull) {
                            con.fillStyle = scheme.fillPieSlice;
                        }
                        else {
                            con.fillStyle = scheme.colorBg;
                        }
                    }
                    else {
                        con.fillStyle = scheme.strokeDeadPieSlice;
                        con.strokeStyle = scheme.strokeDeadPieSlice;
                    }
                    // true if we fill the slice with an inner dot
                    var thisSliceIsSpecial = slice == me.pie.current - 1 && me.tileState.unplayableReason == null && me.tileState.mousedOver;
                    if (thisSliceIsSpecial) {
                        circYMid += me.tileState.bounceY * pieOrbR;
                    }
                    con.moveTo(circXMid, circYMid);
                    con.beginPath();
                    con.arc(circXMid, circYMid, pieOrbR, 0, FULL_ARC);
                    con.fill();
                    con.closePath();
                    con.moveTo(circXMid, circYMid);
                    con.beginPath();
                    con.arc(circXMid, circYMid, pieOrbR, 0, FULL_ARC);
                    con.stroke();
                    con.closePath();
                    if (thisSliceIsSpecial) {
                        con.fillStyle = scheme.strokePieSlice;
                        con.moveTo(circXMid, circYMid);
                        con.beginPath();
                        con.arc(circXMid, circYMid, pieOrbR / 2, 0, FULL_ARC);
                        con.fill();
                        con.closePath();
                    }
                }
            }
            if (me.owner != null) {
                if (me.owner == rules.Player.Black) {
                    con.strokeStyle = scheme.strokeBlack;
                    con.fillStyle = scheme.fillBlack;
                }
                else {
                    con.strokeStyle = scheme.strokeWhite;
                    con.fillStyle = scheme.fillWhite;
                }
                con.moveTo(xmid, ymid);
                con.beginPath();
                con.arc(xmid, ymid, ownerR, 0, FULL_ARC);
                con.fill();
                con.stroke();
                con.closePath();
            }
            if (me.tileState.diesNextTurn) {
                con.strokeStyle = scheme.strokePieSlice;
                con.moveTo(xmid, ymid);
                con.beginPath();
                con.moveTo(xmid - ownerR * 0.2, ymid - ownerR * 0.2);
                con.lineTo(xmid + ownerR * 0.2, ymid + ownerR * 0.2);
                con.moveTo(xmid + ownerR * 0.2, ymid - ownerR * 0.2);
                con.lineTo(xmid - ownerR * 0.2, ymid + ownerR * 0.2);
                con.stroke();
                con.closePath();
            }
            {
                var borderR = r * 0.1;
                con.moveTo(xmid, ymid);
                con.beginPath();
                if (me.pie != null && me.pie.current == 0) {
                    if (me.owner == null) {
                        con.fillStyle = scheme.strokeDeadPieSlice;
                        con.fillRect(xmid - borderR, ymid - borderR, borderR * 2, borderR * 2);
                    }
                    else {
                        con.strokeStyle = scheme.strokeDeadPieSlice;
                        con.strokeRect(xmid - borderR, ymid - borderR, borderR * 2, borderR * 2);
                    }
                    con.closePath();
                }
                else if (me.owner == null) {
                    con.fillStyle = scheme.strokeBlankSpot;
                    con.fillRect(xmid - borderR, ymid - borderR, borderR * 2, borderR * 2);
                    con.fill();
                    con.closePath();
                }
            }
        };
        return View;
    }());
    uiModel.View = View;
    var Layout = (function () {
        function Layout(pixelSize, cellSize) {
            this.pixelSize = pixelSize;
            this.cellSize = cellSize;
        }
        Layout.prototype.usableDimensions = function () {
            var usableCellSz = Math.min(this.pixelSize.x / this.cellSize.x, this.pixelSize.y / this.cellSize.y);
            var usableXSz = usableCellSz * this.cellSize.x;
            var usableYSz = usableCellSz * this.cellSize.y;
            var xOffset = (this.pixelSize.x - usableXSz) / 2;
            var yOffset = (this.pixelSize.y - usableYSz) / 2;
            return ({ corner: new rules.Vec2(xOffset, yOffset),
                size: new rules.Vec2(usableXSz, usableYSz)
            });
        };
        Layout.prototype.cellFor = function (mousePosition) {
            var dims = this.usableDimensions();
            var corner = dims.corner;
            var size = dims.size;
            var canvasXPercentage = (mousePosition.x - corner.x) / size.x;
            var canvasYPercentage = (mousePosition.y - corner.y) / size.y;
            var cellX = Math.floor(canvasXPercentage * this.cellSize.x);
            var cellY = Math.floor(canvasYPercentage * this.cellSize.y);
            return new rules.Vec2(cellX, cellY);
        };
        Layout.prototype.toCellDimensions = function (cellVec) {
            var dims = this.usableDimensions();
            var corner = dims.corner;
            var size = dims.size;
            return ({ corner: new rules.Vec2(corner.x + (size.x / this.cellSize.x) * cellVec.x, corner.y + (size.y / this.cellSize.y) * cellVec.y),
                size: new rules.Vec2(size.x / this.cellSize.x, size.y / this.cellSize.y)
            });
        };
        // make the mouse pointer point at the *center* of a cell, as a percentage of overall size
        Layout.prototype.regularize = function (mousePosition) {
            var cell = this.cellFor(mousePosition);
            var dims = this.toCellDimensions(cell);
            return new rules.Vec2((dims.corner.x + dims.size.x / 2) / this.pixelSize.x, (dims.corner.y + dims.size.y / 2) / this.pixelSize.y);
        };
        return Layout;
    }());
    uiModel.Layout = Layout;
})(uiModel || (uiModel = {}));
var boardBuilding;
(function (boardBuilding) {
    boardBuilding.loadBoard = function (title) {
        var boardTx = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            boardTx[_i - 1] = arguments[_i];
        }
        var height = boardTx.length;
        var width = boardTx[0].length;
        var board = new rules.Board(title, new rules.Vec2(width, height));
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var vec = new rules.Vec2(x, y);
                var word = boardTx[y][x];
                var pie = word.charAt(0);
                var owner = word.charAt(1);
                switch (pie) {
                    case "0":
                        board.pies.unsafeSet(vec, new rules.Pie(0, 0));
                        break;
                    case "1":
                        board.pies.unsafeSet(vec, new rules.Pie(1, 1));
                        break;
                    case "2":
                        board.pies.unsafeSet(vec, new rules.Pie(2, 2));
                        break;
                    case "3":
                        board.pies.unsafeSet(vec, new rules.Pie(3, 3));
                        break;
                    case "4":
                        board.pies.unsafeSet(vec, new rules.Pie(4, 4));
                        break;
                    case "5":
                        board.pies.unsafeSet(vec, new rules.Pie(5, 5));
                        break;
                    case "6":
                        board.pies.unsafeSet(vec, new rules.Pie(6, 6));
                        break;
                    case "7":
                        board.pies.unsafeSet(vec, new rules.Pie(7, 7));
                        break;
                    case "8":
                        board.pies.unsafeSet(vec, new rules.Pie(8, 8));
                        break;
                    case "9":
                        board.pies.unsafeSet(vec, new rules.Pie(9, 9));
                        break;
                    case "-": break;
                    default: throw "invalid pie: " + pie + JSON.stringify(boardTx);
                }
                switch (owner) {
                    case "B":
                        board.owners.unsafeSet(vec, rules.Player.Black);
                        break;
                    case "W":
                        board.owners.unsafeSet(vec, rules.Player.White);
                        break;
                    case "-": break;
                    default: throw "invalid owner: " + owner + JSON.stringify(boardTx);
                }
            }
        }
        return board;
    };
})(boardBuilding || (boardBuilding = {}));
var puzzles;
(function (puzzles) {
    puzzles.introduction = 
    // TODO: A puzzle where you can observe that filling the last hole creates an unplayable space. Or is this covered well already?
    // TODO: Better convey why/how do-nothing moves are rejected
    // TODO: Make sure the "this move kills these pieces" indicator applies to the piece being played, too
    // TODO: Maybe make the little dots shrink inward much further in the "shrink" animation on mouseover when not valid
    // TODO: Shake animation is too fast        
    // Steve was "literally clicking the dots that were "available" as fast as I could"
    // Steve's hard puzzles:
    // - SRCRC
    // - EC_N
    // Steve's points of confusion:
    // - What triggers a red screen? He thinks "wrong move"
    // - By EC_N, he understood that:
    //   - EC_N is the first level with "multiple smaller dots per large dot"
    //   - [with a vague prodding question] 
    //     The only thing that seems to matter is the order in which the elements are clicked. 
    //     There are a small finite number of possible paths.
    //   - Had no idea what was causing him to advance.
    //     - Retconned this to "noticed the obvious, like 'fill up all the smaller dots to complete the level'"
    //   - Thought the vibrating yellow dot signal was a good cue.
    //
    // Suggestion: EC_N is the first puzzle that made him think "I'm going to need to think to understand this game."
    //   - Maybe move it up earlier?
    //   - EC_1/2 is a puzzle that you can actually fail.
    //   - Maybe move WDTC up too?
    //   - Probably don't start with so many puzzles that are just about filling dots.
    //
    // Personal thought:
    //   2D board may look harder to brute-force, and it requires more moves to set up a capture in 2D.
    //
    // Ben:
    //   - Played a game with a much shorter intro sequence, omitting the puzzles designed to make it seem arduous to fill all small circles.
    //     - This seemed to shortchange him on understanding the game's goal.
    //   - Thinks the goal is to connect all circles. 
    //     The rules for connecting white circles are supposedly different than the rules for connecting black ones.
    //   - Is not sure what the yellow screen means, but he thinks he's advancing.
    //   - Once he saw the red screen, he was pretty sure the yellow screen meant success.
    //   - Did not understand what changes in background color meant.
    //   - Did not understand that clicking a quota tile consumed an orb.
    //   - Agrees that it's very important to be able to fail on early levels.
    //   - TODO: Perhaps introduce quota tiles that flat-out kill you?
    //   - Opening puzzles are frankly way too easy.
    //   - Thinks connecting black and white tiles is a very bad idea.
    //   - Did not infer any particular meaning from the enemy-friendly arc separators yet. I think I need to not use 1D, since it gives the arcs two apparent meanings.
    //   - Suggested to move the "pumping" levels back, as those are easier to understand.
    //   - Found orb rotation confusing
    // Emma and Ben weren't clear on what the win-state is, so have some puzzles where you have to search
    // for what to fill
    // TODO: These are exclusively RNG puzzles. Cover the topics list from last time.
    // pumping puzzle 1
    [boardBuilding.loadBoard("PU1", ["0-", "0W", "8-", "0W", "0-"], ["0-", "0B", "8-", "0B", "0-"]),
        boardBuilding.loadBoard("TUGH", ["-W", "0W", "-W"], ["-W", "2-", "-W"], ["1-", "0B", "1-"]),
        boardBuilding.loadBoard("TUGB", ["1W", "2-", "-B"], ["1-", "1-", "-B"], ["-B", "-B", "--"]),
        boardBuilding.loadBoard("TUGEC", ["0B", "-B", "2W"], ["0B", "-B", "1-"], ["-B", "1-", "--"])
    ];
})(puzzles || (puzzles = {}));
// TODO: only use Layout for Layout stuff
var domCrap;
(function (domCrap) {
    domCrap.createGame = function (el, sequence) {
        sequence = sequence.concat([]); // clone
        var drawParts = new uiModel.DrawParts(el);
        var nowBoard;
        var model;
        var layout;
        var loadNextBoard = function () {
            var boardNew = sequence.shift();
            if (boardNew) {
                nowBoard = boardNew;
            }
            else {
                // TODO: Do something else interesting to get a board
                // 6, 3 is good for widescreen
                // the largest I can play is 9, 9
                nowBoard = gen.Generator.generate(new rules.Vec2(3, 3));
            }
            model = new uiModel.UiModel(nowBoard);
            recalculateLayout();
        };
        var restartBoard = function () {
            model = new uiModel.UiModel(nowBoard);
            recalculateLayout();
        };
        var recalculateLayout = function () {
            el.style.position = "fixed";
            layout = new uiModel.Layout(new rules.Vec2(window.innerWidth, window.innerHeight), nowBoard.pies.size);
            el.style.left = "0px";
            el.style.top = "0px";
            el.style.width = window.innerWidth + "px";
            el.style.height = window.innerHeight + "px";
            el.width = window.innerWidth;
            el.height = window.innerHeight;
            drawParts.newCanvas.width = window.innerWidth;
            drawParts.newCanvas.height = window.innerHeight;
        };
        var update = function () {
            model.update("Tick");
            uiModel.View.view(model, drawParts);
            if (model.uiGlobals.completedTicks == 60 && model.completeState == uiModel.CompleteState.Succeeded) {
                loadNextBoard();
            }
            if (model.uiGlobals.completedTicks == 180 && model.completeState == uiModel.CompleteState.Failed) {
                restartBoard();
            }
            requestAnimationFrame(update);
        };
        el.addEventListener('mousemove', function (e) {
            var pxVec = new rules.Vec2(e.clientX, e.clientY);
            var mouseCell = layout.cellFor(pxVec);
            var mousePos = layout.regularize(pxVec);
            model.update(["MouseOver", mouseCell, mousePos]);
        });
        el.addEventListener('mousedown', function (e) {
            var pxVec = new rules.Vec2(e.clientX, e.clientY);
            var mouseCell = layout.cellFor(pxVec);
            var mousePos = layout.regularize(pxVec);
            model.update(["Click", mouseCell, mousePos]);
        });
        window.addEventListener("resize", function (e) { return recalculateLayout(); });
        loadNextBoard(); // also recalculates size
        update();
    };
})(domCrap || (domCrap = {}));
//# sourceMappingURL=rules.js.map