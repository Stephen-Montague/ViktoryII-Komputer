// Begin main script.
console.log("Hello Viktory.");

// Setup.
if (!window.isKomputerReady)
{
    setInterval(function()
    {
        if (hasGamesByEmailFoundation())
        {
            if (setupExtension())
            {
                clearIntervalsAndTimers();
                window.isKomputerReady = true;
            }
        }
    }, 640);
}


function hasGamesByEmailFoundation()
{
    return (typeof(GamesByEmail) !== "undefined" && GamesByEmail && GamesByEmail.findFirstGame);
}


function setupExtension()
{
    // Alias the game, add controls, patch
    const thisGame = GamesByEmail.findFirstGame(); 
    verifyElementalIds(thisGame); 
    if (isGameReady(thisGame))
    {
        patchControls();
        addTouchSupport();
        patchGamePrototype();
        patchPiecePrototype();
        patchUnitPrototype();
        if (!document.getElementById("KomputerButton"))
        {
            cacheElementsForStyling(thisGame);
            styleGameMessageBox(thisGame);
            addRunButton("Let Komputer Play", runKomputerClick, thisGame);
            addStopButton("Stop", stopKomputerClick);
            addDarkModeToggle();
            addBoardBuilder(thisGame);
            addLocalMultiplayer(thisGame);
        }
        window.onerror = function() 
        {
            console.warn("Caught error. Will reset controls.");
            stopAndReset(true);
        }
        return true;
    };
    return false;
}


function verifyElementalIds(thisGame)
{
    if (!thisGame)
    {
        return;
    }
    // The elemental Id is normally the registry index.
    window.gameVersion = thisGame.$Foundation_$registry_index;
    let isCorrectId = false;
    if (document.getElementById('Foundation_Elemental_' + gameVersion + '_bottomTeamTitles'))
    {
        isCorrectId = true;
    }
    // Otherwise search for it.
    if (!isCorrectId)
    {
        for (let i = 0; i < 42; i++)
        {
            if (document.getElementById('Foundation_Elemental_' + i + '_bottomTeamTitles'))
            {
                window.gameVersion = i;
                isCorrectId = true;
                break;
            }
        } 
        if (!isCorrectId)
        {
            window.gameVersion = null;
            return;
        }
    }
}


function isGameReady(thisGame)
{
    return (thisGame && gameVersion && typeof(thisGame.movePhase) === "number" &&
        document.getElementById('Foundation_Elemental_' + gameVersion + '_bottomTeamTitles'));
}


// Begin play.
function runKomputerClick(thisGame)
{
    if (isKomputerReady)
    {
        if (thisGame.previewing || thisGame.player.isMyTurn())
        {
            resetGlobals();
            disableBoardBuilder();
            styleButtonForRun();
            runKomputer(thisGame);
        }
        else
        {
            window.isKomputerReady = false;
            const isGameWon = thisGame.checkForWin();
            const alternateMessage = "Enemy Turn";
            resetKomputerButtonStyle(isGameWon, alternateMessage);
            setTimeout(function()
            {
                window.isKomputerReady = true;
                resetKomputerButtonStyle(isGameWon);
            }, 1200);
        }
    }
}


function clearIntervalsAndTimers()
{
    for (var i = setTimeout(function() {}, 0); i > 0; i--) 
    {
        window.clearInterval(i);
        window.clearTimeout(i);
    }
}


function resetGlobals(resetKomputerButton = false)
{
    const thisGame = GamesByEmail.findFirstGame();
    verifyElementalIds(thisGame);
    window.currentPlayerTurn = thisGame.perspectiveColor;
    window.isSmallBoard = thisGame.pieces.length === 62;
    window.isLargeBoard = !isSmallBoard;
    window.stopKomputer = false;
    window.moveIntervalId = null;
    window.movingUnitIndex = 0;
    window.moveWave = 0;
    window.flashIndex = 0;
    window.flashIds = [];
    window.holdingUnits = [];
    window.hasBattleBegun = false;
    window.isBombarding = false;
    window.isExploring = false;
    window.isManeuveringToAttack = false;
    window.isUnloading = false;
    window.isKomputerReady = false;
    if (resetKomputerButton)
    {
        resetKomputerButtonStyle(false);
        window.isKomputerReady = true;
    }
}


function runKomputer(thisGame)
{
    if (window.stopKomputer === true)
    {
        stopAndReset();
        return;
    }
    hideEndTurnButtons();
    maybeClearLastAction(thisGame);
    setTimeout(function(){ handleCurrentState(thisGame) }, 100);
}

function handleCurrentState(thisGame)
{
    console.log("Checking movePhase.");
    switch(thisGame.movePhase)
    {
        case 0:
            console.log("Game won.");
            setTimeout(function(){
                thisGame.maxMoveNumber = 0;
                window.isKomputerReady = true;
                resetKomputerButtonStyle(true);
                }, 1200);
            break;
        case 2:
            console.log("Placing capital.");
            placeCapital(thisGame);
            break;
        case 5:
            console.log("Movement Wave: " + window.moveWave);
            moveUnits(thisGame);
            break;
        case 6:
            console.log("Retreat is not an option. Returning to battle.");
            thisGame.movePhase = 5;
            thisGame.update();
            break;
        case 11:
            console.log("Placing reserves.");
            placeReserves(thisGame);
            break;
        default:
            console.warn("Unhandled movePhase: " + thisGame.movePhase);
            stopAndReset();
            break;
    }
}


// If the human began to explore or fight, clear this first.
function maybeClearLastAction(thisGame)
{
    let activeExploration = thisGame.playOptions.mapCustomizationData;
    const isNotCapitalMovePhase = thisGame.movePhase !== 2;
    if (isNotCapitalMovePhase && activeExploration.length > 0)
    {
        thisGame.playOptions.mapCustomizationData = shuffle(activeExploration);
        thisGame.customizeMapDoAll(true);
    }
    let overlayCommit = document.getElementById("Foundation_Elemental_" + gameVersion + "_overlayCommit");
    if (overlayCommit && overlayCommit.value === "Roll for Battle")
    {
        thisGame.undo();
    }
}


function moveUnits(thisGame)
{
    hideEndTurnButtons();
    const moveIntervalPeriod = 1500;
    const initialDelay = 400;
    setTimeout(async function(plan){
        switch (window.moveWave)
        {
            case 0: {
                console.log("May move land units.");
                let landUnits = findAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                orderFromFarthestToEnemy(thisGame, landUnits, false);
                moveEachUnit(thisGame, landUnits, moveIntervalPeriod, plan);
                break;
            }
            case 1: {
                console.log("May move frigates.");
                const frigates = findFrigates(thisGame, [thisGame.perspectiveColor]);
                moveEachUnit(thisGame, frigates, moveIntervalPeriod, plan);
                break;
            }
            case 2: {
                console.log("May move all available.");
                let army = findAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                const navy = findFrigates(thisGame, [thisGame.perspectiveColor]);
                const armyNavy = army.concat(navy);
                const allMilitaryUnits = armyNavy.concat(window.holdingUnits);
                moveEachUnit(thisGame, allMilitaryUnits, moveIntervalPeriod, plan);
                break;
            }
            case 3: {
                console.log("Handling all battles.");
                const battlePiece = findNextBattle(thisGame);
                if (battlePiece)
                {
                    fightBattle(thisGame, battlePiece);
                }
                else
                {
                    window.moveWave++;
                    runKomputer(thisGame);
                }
                break;
            }
            case 4: {
                console.log("Ending movement.");
                endMovementPhase(thisGame);
                break;
            }
            default: {
                console.warn("Stop and reset due to invalid moveWave: " + window.moveWave)
                stopAndReset();
                break;
            }
        }
    }, initialDelay);
}


function findAvailableLandUnits(thisGame, color)
{
    let landUnits = [];
    for (const piece of thisGame.pieces)
    {
        // Skip reserve units
        if (piece.valueIndex === - 1)
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (unit.color === color && unit.type !== "f" && (unit.canMove() || unit.canBombard()) && !unit.holding)
            {
                landUnits.push(unit);
            }
        }
    }
    return landUnits;
}


function orderFromFarthestToEnemy(thisGame, units, reverse)
{
    const enemyColors = getEnemyColors(thisGame);
    let enemyArmies = getArmyUnits(thisGame, enemyColors);
    if (!enemyArmies)
    {
        return;
    }
    for (const unit of units)
    {
        let minDistance = Number.MAX_VALUE;
        for (const enemyArmy of enemyArmies)
        {
            const distance = thisGame.distanceBewteenPoints(enemyArmy.piece.boardPoint, unit.piece.boardPoint);
            if (distance < minDistance)
            {
                minDistance = distance;
            }
        }
        unit.minDistanceToEnemy = minDistance;
    }
    units.sort(function(a, b){ return b.minDistanceToEnemy - a.minDistanceToEnemy });
    if (reverse)
    {
        units.reverse();
    }
}


function getEnemyColors(thisGame)
{
    const colorCount = thisGame.numberOfDistinctPlayers;
    if (colorCount === 2)
    {
        return [!thisGame.perspectiveColor * 1];
    }
    let enemyColors = [];
    for (let color = 0; color < colorCount; color++) 
    {
        if (color !== thisGame.perspectiveColor)
        {
            enemyColors.push(color);
        }
    }
    return enemyColors;
}


function findFrigates(thisGame, colors, pieceList)
{
    let frigates = [];
    if (typeof(pieceList) === "undefined")
    {
        pieceList = thisGame.pieces;
    }
    for (const piece of pieceList)
    {
        const isReserve = piece.valueIndex === - 1;
        if (isReserve || piece.hasBattle(thisGame.perspectiveColor, -1))
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (colors.includes(unit.color) && unit.type === "f")
            {
                frigates.push(unit);
            }
        }
    }
    return frigates;
}


async function endMovementPhase(thisGame)
{
    // Reset movement, then restart loop to place reserves, or stop for the next player.
    window.moveWave = 0;
    clearHoldingUnits();
    thisGame.endMyMovement();
    window.moveIntervalId = await setInterval(function(){
        if (thisGame.movePhase === 11)
        {
            clearIntervalsAndTimers();
            runKomputer(thisGame);
        }
        else if(window.currentPlayerTurn !== thisGame.perspectiveColor)
        {
            clearIntervalsAndTimers();
            window.isKomputerReady = true;
            resetKomputerButtonStyle();
            console.log("Done.");
        }
        else
        {
            thisGame.endMyMovement();
        }
    }, 200);
}


async function moveEachUnit(thisGame, movableUnits, intervalPeriod)
{
    window.moveIntervalId = await setInterval(function(){
        if (window.stopKomputer === true)
        {
            stopAndReset();
            return;
        }
        if (window.hasBattleBegun || window.isBombarding || window.isExploring)
        {
            return;
        }
        // Check for any battle that should be fought before further moves.
        if (thisGame.hasBattlesPending && !isUnloading)
        {
            for (const piece of thisGame.pieces)
            {
                if (piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
                {
                    if (isNotOverkill(thisGame, piece))
                    {
                        continue;
                    }
                    console.log("Blitz attack!");
                    clearIntervalsAndTimers();
                    clearMovementFlags();
                    fightBattle(thisGame, piece);
                    return;
                }
            }
        }
        // Get the next unit and decide if it may move.
        const nextUnitIndex = getNextUnitIndex(thisGame, movableUnits);
        const isClickable = ensureIsClickable(thisGame, movableUnits, nextUnitIndex);
        const unit = movableUnits[nextUnitIndex];
        const firstMoveWave = 0;
        const finalMoveWave = 2;
        const mayMove = decideMayMove(thisGame, unit, firstMoveWave, finalMoveWave, isClickable);
        if (mayMove)
        {
            const possibleMoves = unit.isFrigate() ? getFrigateMovables(unit) : unit.getMovables();
            if (possibleMoves)
            {
                // Decide best move, or don't accept any to stay.
                const favorOffense = shouldFavorOffense(thisGame, firstMoveWave, movableUnits.length);
                const bestMove = decideBestMove(thisGame, possibleMoves, unit, favorOffense);
                const pieceIndex = bestMove.index;
                const shouldAcceptMove = decideMoveAcceptance(thisGame, unit, pieceIndex);
                if (shouldAcceptMove)
                {
                    flashMoveTrail(thisGame, unit, possibleMoves, bestMove);
                    setTimeout(function(){
                        // Move unit.
                        const isUnitSelected = moveUnitSimulateMouseDown(thisGame, unit.screenPoint, unit.type);
                        if (isUnitSelected)
                        {
                            const destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                            moveUnitSimulateMouseUp(thisGame, destinationScreenPoint);
                            // Commit to explore after some processing time.
                            const normalPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_overlayCommit");
                            if ((normalPopup || document.getElementById("Foundation_Elemental_" + gameVersion + "_customizeMapDoAll")) &&
                                !document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyTurn"))
                            {
                                window.isExploring = true;
                                clearIntervalsAndTimers();
                                if (normalPopup)
                                {
                                    thisGame.overlayCommitOnClick();
                                }
                                setTimeout(function(){
                                    settleExploredTerrain(thisGame, unit);
                                }, 128);
                            }
                            // Make sure frigates can unload all cargo
                            if (unit.isFrigate() && unit.hasUnloadables() && (window.moveWave === finalMoveWave) && thisGame.pieces[pieceIndex].isLand())
                            {
                                window.isUnloading = true;
                            }
                            else
                            {
                                window.isUnloading = false
                            }
                        } // End if isUnitSelected
                        // On the rare case the unit isn't ready, push it to the end for later.
                        else
                        {
                            clearMovementFlags();
                            movableUnits.push(movableUnits.splice(window.movingUnitIndex, 1)[0]);
                            const isValidUnit = unit && unit.piece && thisGame.pieces[unit.piece.index].units[unit.index];
                            if (isValidUnit)
                            {
                                unit.setHilite(false);
                            }
                        }   
                    }, 256);
                } // End if shouldAcceptMove
            } // End if possibleMoves
        } // End if may move
        setTimeout(function(){
            decideHowToContinueMove(thisGame, movableUnits, unit, finalMoveWave);}, 400);
    }, intervalPeriod);
}


function ensureMovementComplete(thisGame, battlePiece)
{
    const piece = thisGame.pieces[battlePiece.index];
    for (let unit of piece.units)
    {
        if (unit.isMilitary())
        {
            unit.spacesMoved = unit.movementAllowance;
            unit.movementComplete = true;
        }
    }
}


function clearMovementFlags()
{
    window.isBombarding = false
    window.isExploring = false;
    window.isManeuveringToAttack = false;
    window.isUnloading = false;
}


function getNextUnitIndex(thisGame, movableUnits)
{
    if (!movableUnits || movableUnits.length === 0)
    {
        return null;
    }
    let nextUnitIndex = window.movingUnitIndex < movableUnits.length ? window.movingUnitIndex : movableUnits.length - 1;
    let movableUnit = movableUnits[nextUnitIndex];
    while (isNotValidUnit(thisGame, movableUnit) && (nextUnitIndex + 1 < movableUnits.length))
    {
        nextUnitIndex++;
        movableUnit = movableUnits[nextUnitIndex];
    }
    window.movingUnitIndex = nextUnitIndex;
    return nextUnitIndex;
}


function ensureIsClickable(thisGame, movableUnits, nextUnitIndex)
{
    let movableUnit = movableUnits[nextUnitIndex];
    if (isNotValidUnit(thisGame, movableUnit))
    {
        return false;
    }
    // If there's another movable unit of the same type and status in front, insert the other unit at the next unit index. 
    let piece = movableUnit.piece;
    for (const unit of piece.units)
    {
        if (unit.movementComplete || unit.index === movableUnit.index || !movableUnits.includes(unit))
        {
            continue;
        }
        if (unit.type === movableUnit.type && unit.retreatIndex === movableUnit.retreatIndex && unit.zIndex > movableUnit.zIndex)
        {
            movableUnits.splice(nextUnitIndex, 0, movableUnits.splice(movableUnits.indexOf(unit), 1)[0]);
        }
    }
    return true;
}


function shouldFavorOffense(thisGame, firstMoveWave, movingUnitsLength)
{
    const isLikelyHelpful = thisGame.maxMoveNumber > 25 && movingUnitsLength > 2;
    return (isLikelyHelpful && window.moveWave === firstMoveWave && window.movingUnitIndex < (movingUnitsLength * 0.4))
}


function decideMayMove(thisGame, unit, firstMoveWave, finalMoveWave, canClick)
{
    if (!canClick || isNotValidUnit(thisGame, unit))
    {
        window.isManeuveringToAttack = false;
        window.isBombarding = false;
        return false;
    }
    if (window.hasBattleBegun || window.isBombarding || window.isExploring)
    {
        return false;
    }
    // When unit can move or unload:
    if (!unit.movementComplete || unit.hasUnloadables())
    {
        // Empty frigates shouldn't move on the last wave.
        if (unit.type === "f" && window.moveWave === finalMoveWave && !unit.hasUnloadables())
        {
            return false;
        }
        // Hold back artillery and cavalry who don't have an adjacent frigate and who aren't maneuvering to attack from moving the first wave - to better support any battles started by infantry.
        return ( window.moveWave > firstMoveWave ? true : (unit.type === "c" || unit.type === "a") && !hasAdjacentFrigate(thisGame, unit.piece) && !window.isManeuveringToAttack ? false : true );
    }
    if (unit.isFrigate() && !unit.hasUnloadables())
    {
        window.isUnloading = false;
    }
    return false;
}


function isNotValidUnit(thisGame, unit)
{
    return (!unit || !unit.piece || !thisGame.pieces[unit.piece.index].units[unit.index]); 
}


function settleExploredTerrain(thisGame, unit)
{
    const waterPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_waterSwap");
    if (waterPopup)
    {
        thisGame.swapWaterForLand();
        console.log("Water swap!");
    }
    const hexTerrain = thisGame.getMapCustomizationData();
    if (hexTerrain.length > 1)
    {
        const newHexOrder = decideHexOrder(thisGame, hexTerrain, unit.piece.boardPoint);
        thisGame.playOptions.mapCustomizationData = newHexOrder;
    }
    setTimeout(function()
    {
        thisGame.customizeMapDoAll(true);
        window.explorationId = setInterval(function()
        {
            if (isDoneExploring(thisGame))
            {  
                clearInterval(window.explorationId);
                window.isExploring = false;
                runKomputer(thisGame);
            } 
            setTimeout(function(){
                ensureValidBoard(thisGame);
            }, 200)
        }, 200);
    }, 600);
}


function flashMoveTrail(thisGame, unit, possibleMoves, movePoint)
{
    unit.setHilite(true);
    let flashTrailPoints = [];
    let runCount = 0;
    const failsafe = 3;
    do 
    {
        let piece = thisGame.pieces.findAtPoint(movePoint);
        flashTrailPoints.unshift(piece.boardPoint);
        for (const possibleMove of possibleMoves)
        {
            if (movePoint.retreatIndex === possibleMove.index)
            {
                movePoint = possibleMove;
            }
        }
        runCount++;
    } while (movePoint.retreatIndex !== unit.piece.index && runCount < failsafe)
    window.flashIndex = 0;
    window.flashIds.push(setInterval(function(){ 
        if (window.flashIndex < flashTrailPoints.length)
        {
            thisGame.pieces.flash(1, null, flashTrailPoints[flashIndex]);
            flashIndex++;
        }
        else
        {
            for (const Id of window.flashIds)
            {
                clearInterval(Id);
            }
            flashIndex = 0;
        }
    }, 200));
}


function isDoneExploring(thisGame)
{
    return (thisGame.playOptions.mapCustomizationData === "");
}


function decideHowToContinueMove(thisGame, movableUnits, unit, finalMoveWave)
{
    hideEndTurnButtons();
    window.isManeuveringToAttack = (window.isManeuveringToAttack && !unit.movementComplete && !unit.holding) ? true : false;
    if (window.isExploring || window.isBombarding || window.isUnloading || window.isManeuveringToAttack)
    {
        // Pass: wait for these to finish.
    }
    else if (shouldBombard(thisGame, unit, finalMoveWave))
    {
        window.isBombarding = true;
        clearIntervalsAndTimers();
        unit.movementComplete = true;
        unit.holding = false;
        window.isManeuveringToAttack = false; 
        bombard(thisGame, unit, unit.getBombardables());
    }
    // Move the next unit next interval.
    else if ( (window.movingUnitIndex + 1) < movableUnits.length )
    {
        window.movingUnitIndex++;
    }
    // Clear interval, reset moving unit index, cue next wave or game action.
    else
    {
        clearInterval(window.moveIntervalId);
        window.movingUnitIndex = 0;
        window.moveWave++;
        runKomputer(thisGame);
    }
}


function shouldBombard(thisGame, unit, finalMoveWave)
{
    return (unit && unit.piece && unit.canBombard() && (unit.movementComplete || moveWave >= finalMoveWave) &&
        (hasAdjacentEnemyArmy(thisGame, unit.piece) || hasAdjacentEnemyFrigate(thisGame, unit.piece)));
}


function decideBestMove(thisGame, possibleMoves, unit, favorOffense)
{
    let bestMoveScore = -1;
    let bestMoves = [];
    for (const possibleMove of possibleMoves)
    {
        const possibleMoveScore = getMoveScore(thisGame, possibleMove, unit, favorOffense);
        if (possibleMoveScore > bestMoveScore)
        {
            bestMoveScore = possibleMoveScore;
            bestMoves = [];
            bestMoves.push(possibleMove);
        }
        else if (possibleMoveScore === bestMoveScore)
        {
            bestMoves.push(possibleMove);
        }
    }
    return (bestMoves.length > 1 ? getRandomItem(bestMoves) : bestMoves.pop());
}


function getMoveScore(thisGame, possibleMove, unit, favorOffense)
{
    const piece = thisGame.pieces.findAtXY(possibleMove.x, possibleMove.y);
    const enemyColor = piece.getOpponentColor(thisGame.perspectiveColor);
    const primaryTargetColors = getPrimaryTargetColors(thisGame);
    if (unit.isFrigate())
    {
        return getFrigateMoveScore(thisGame, piece, unit, enemyColor, primaryTargetColors);
    }
    else
    {
        let score = 0;
        // Convert terrain defenses of [0, 1, 2] to [0.05, 0.1, 0.15].
        const terrainDefenseBonus = 0.1 * (( piece.terrainDefenses() * 0.5 ) + 0.5);
        if (piece.hasRollingOpponent(thisGame.perspectiveColor))
        {
            const defendingUnitCount = piece.countOpponentMilitary(thisGame.perspectiveColor);
            const defendingRollCount = piece.numDefenderRolls(piece.getOpponentColor(thisGame.perspectiveColor));
            const defensivePower = (0.08 * defendingRollCount) + (0.04 * defendingUnitCount);

            // Check enemy cities & towns.
            if (piece.hasOpponentCivilization(thisGame.perspectiveColor))
            {
                // Urgently try to retake a lost capital.
                if (piece.hasCapital(thisGame.perspectiveColor))
                {
                    return 1;
                }
                // Complete any tactical maneuver across open terrain.
                if (window.isManeuveringToAttack && piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
                {
                    return 1;
                }
                // Look for undefended enemy towns.
                if (defendingUnitCount === 0)
                {
                    return piece.hasCapital(enemyColor) ? 0.99 : defendingRollCount === 1 ? 0.98 : 0.96;
                }
                // Then look at weaker enemy towns.
                score = 1 - defensivePower;
                // Randomly vary the priority of attacks so that:
                // Units often beseige, when random is low, and may attack a heavy defense even, when random is high.
                score += 0.125 * Math.random() + (1 - score) * Math.random() * 0.25;
                // More likely attack when already in an ideal seige location or in a civ not under seige or in the capital.
                if (((unit.piece.isMountain() || unit.piece.isForest()) && hasAdjacentEnemyCivilization(thisGame, unit.piece)) ||
                    ((unit.piece.hasCivilization(thisGame.perspectiveColor) && !unit.piece.hasAdjacentRollingEnemy(thisGame.perspectiveColor, thisGame.player.team.rulerColor))) || 
                    unit.piece.hasCapital(thisGame.perspectiveColor))
                {
                    score += 0.125 
                }
            }
            // Check enemy in the countryside.
            else
            {
                score = 0.9 - defensivePower;
                // Prioritize enemy beseiging / pinning a friendly town.
                if (hasAdjacentFriendlyCiv(thisGame, piece))
                {
                    score += 0.12 * Math.random() + (1 - score) * Math.random() * 0.4;
                    if (unit.piece.hasCapital(thisGame.perspectiveColor))
                    {
                        score = 0.96; 
                    }
                }
            }
            // More likely join battles already begun, especially artillery and cavalry, but avoid overkill on weak targets.
            if (piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
            {
                if (isNotOverkill(thisGame, piece))
                {
                    score += unit.type === "i" ? 0.2 : 0.4;
                }
            }
            if (!primaryTargetColors.includes(enemyColor))
            {
                score *= 0.6;
            }
        }
        // Try to beseige / pin enemy cities and towns, on the safest terrain.
        else if ((hasAdjacentEnemyCivilization(thisGame, piece) && !piece.hasFrigate(thisGame.perspectiveColor)) || 
            (hasAdjacentEnemyArmy(thisGame, piece) && hasAdjacentBattle(thisGame, piece) && !piece.hasFrigate(thisGame.perspectiveColor)))
        {
            score = hasAdjacentEnemyCivilization(thisGame, piece) ? 0.7 + terrainDefenseBonus : 0.6 + terrainDefenseBonus;
            // If already in an ideal seige location, value another one less.
            if ((unit.piece.isMountain()) && hasAdjacentEnemyCivilization(thisGame, unit.piece))
            {
                score -= 0.0625;
            }
            // Focus on primary targets
            const adjacentIndecies = piece.getAdjacentIndecies(1);
            let isTargetPrimary = false;
            for (const index of adjacentIndecies)
            {
                const adjacentPiece = thisGame.pieces[index];
                if (adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor))
                {
                    let opponentColor = adjacentPiece.getOpponentColor(thisGame.perspectiveColor);
                    if (primaryTargetColors.includes(opponentColor))
                    {
                        isTargetPrimary = true;
                    }
                } 
            }
            score *= isTargetPrimary? 1 : 0.6;
            // Try to never leave cavalry alone in the open next to an enemy civ.
            const remainingMoveAllowance = unit.movementAllowance - unit.spacesMoved;
            if (unit.isCavalry() && hasSmoothTerrain(thisGame, piece.index) && (piece.countMilitaryUnits(piece.units) == 0) &&
                (possibleMove.spacesNeeded === remainingMoveAllowance))
            {
                score = 0;
            }
            // Maybe maneuver unit before attack.
            // If unit has extra moves close to a battle, pass through open terrain to get more attack vectors.
            const canManeuverBeforeAttack = (possibleMove.spacesNeeded < remainingMoveAllowance && 
                (unit.type === "c" || hasSmoothTerrain(thisGame, piece.index) || Math.random() < 0.20));
            if (canManeuverBeforeAttack && hasAdjacentBattle(thisGame, piece)) 
            {
                const battlePiece = findAdjacentBattle(thisGame, piece);
                const attackVectors = battlePiece.collectRetreatIndices(thisGame.perspectiveColor);
                if (!attackVectors.includes(piece.index))
                {
                    window.isManeuveringToAttack = true;
                    return 1;
                }
            }
        }
        // Give importance to own civ defense.
        else if (piece.hasCivilization(thisGame.perspectiveColor))
        {
            const isEarlyGame = thisGame.maxMoveNumber < 25;
            const centerWeight = isEarlyGame ? getEuclideanDistanceToPoint(getCenterPieceBoardPoint(thisGame), piece.boardPoint) : 0;
            const isPinned = (hasAdjacentEnemyArmy(thisGame, piece) || hasAdjacentEnemyFrigate(thisGame, piece));
            const defensivePower = isPinned ? calculateDefensivePower(thisGame, piece) : 0;
            const threat = isPinned ? guessThreat(thisGame, piece) : 0;
            score = (isPinned && defensivePower < threat) ? ( piece.hasCapital(thisGame.perspectiveColor) || (defensivePower < 3) ) ? 0.95 + (0.04 * Math.random()) : 0.92 + (0.04 * Math.random()): (0.7 / (guessTravelCostToEnemy(thisGame, unit, piece) + centerWeight));
            if (favorOffense && score > 0.7)
            {
                score -= 0.125;
            }
        }
        // Consider boarding a frigate.
        else if (piece.hasFrigate(thisGame.perspectiveColor))
        {
            score = 0;
            const frigates = findFrigates(thisGame, [thisGame.perspectiveColor], [piece])
            const canReachEnemy = hasReachableEnemy(thisGame, frigates[0], true);
            if (canReachEnemy)
            {
                for (const frigate of frigates)
                {
                    const hasCapacity = frigate.cargo.length + frigate.cargoUnloaded < 3;
                    if (!hasCapacity)
                    {
                        continue;
                    }
                    score += (!frigate.movementComplete || hasAdjacentEnemyCivilization(thisGame, piece) || hasAdjacentEnemyArmy(thisGame, piece)) ? 0.82 : 0;
                    const useCavalry = Math.random() < 0.6 || (!unit.piece.hasInfantry(thisGame.perspectiveColor) && !unit.piece.hasArtillery(thisGame.perspectiveColor));
                    const hasCargo = frigate.cargo.length > 0;
                    if ((!unit.isCavalry() || useCavalry) && (hasCargo || (Math.random() < 0.6)))
                    {
                        // Max score range of [0.945, 0.9775], so it can compete with any other attacking or defending moves, except maximum priority ones.
                        score += 0.125 + (0.0325 * Math.random());
                    }
                }
            }
        }
        // Move towards an enemy target, ending on the safest terrain.
        else
        {
            const travelCostToEnemy = guessTravelCostToEnemy(thisGame, unit, piece);
            const isEarlyGame = thisGame.maxMoveNumber < 25;
            const centerWeight = isEarlyGame ? getEuclideanDistanceToPoint(getCenterPieceBoardPoint(thisGame), piece.boardPoint) : 0;
            if (hasThreat(thisGame, piece))
            {
                score = (0.56 + terrainDefenseBonus) / (travelCostToEnemy + centerWeight);
            }
            else
            {
                score = 0.66 / (travelCostToEnemy + centerWeight);
            }
            score += hasAdjacentHiddenTerrain(thisGame, piece) ? 0.125 : 0;
            // Special case - on the first turn, urge Red to explore towards the bottom-center rather than the periphery. 
            if (isSmallBoard && thisGame.maxMoveNumber < 12 && (piece.index === 15 || piece.index === 22))
            {
                score += 0.125;
            }
        }
        // Clamp and dampen score. Special cases return up to including 1. 
        score = score < 0 ? 0 : score > 1 ? 0.95 : score;
        return score;
    }
}


function getPrimaryTargetColors(thisGame)
{
    let primaryTargetColors = [];
    const enemyColors = getEnemyColors(thisGame);
    if (enemyColors.length === 1)
    {
        return enemyColors;
    }
    const currentPlayerScore = thisGame.pieces.getScore(thisGame.perspectiveColor);
    let totalScore = currentPlayerScore;
    let enemyScores = [];
    for (const enemyColor of enemyColors)
    {
        const enemyScore = thisGame.pieces.getScore(enemyColor)
        enemyScores.push(enemyScore);
        totalScore += enemyScore;
    }
    for (let i = 0; i < enemyScores.length; i++)
    {
        const enemyScore = enemyScores[i];
        if (enemyScore > (0.4 * totalScore))
        {
            primaryTargetColors.push(enemyColors[i]);
        }
    }
    const hasPrimaryTarget = primaryTargetColors.length > 0;
    return hasPrimaryTarget ? primaryTargetColors : enemyColors;
}


function getCenterPieceBoardPoint(thisGame)
{
    const centerPieceIndex = Math.floor((thisGame.pieces.length * 0.5) - 1);
    return thisGame.pieces[centerPieceIndex].boardPoint; 
}


function getEuclideanDistanceToPoint(pointA, pointB)
{
    return Math.sqrt((pointA.x-pointB.x)*(pointA.x-pointB.x)+(pointA.y-pointB.y)*(pointA.y-pointB.y));
}


function guessTravelCostToEnemy(thisGame, unit, pieceOrigin)
{    
    const maxDistance = 64;
    let travelCost = maxDistance;
    let possibleUnit = pieceOrigin.addUnit(thisGame.perspectiveColor, unit.type);
    possibleUnit.movementAllowance = maxDistance;
    const allReachablePoints = possibleUnit.getMovables();
    if (allReachablePoints && allReachablePoints.length)
    {
        for (const reachablePoint of allReachablePoints)
        {
            const reachablePiece = thisGame.pieces[reachablePoint.index];
            if (reachablePiece.hasRollingOpponent(thisGame.perspectiveColor) && reachablePoint.spacesNeeded < travelCost)
            {
                travelCost = reachablePoint.spacesNeeded;
            }        
        }
    }
    pieceOrigin.removeUnit(possibleUnit);
    if (travelCost === maxDistance)
    {
        const enemyColors = getEnemyColors(thisGame);
        const enemyColor = getRandomItem(enemyColors);
        const enemyCapital = thisGame.pieces.findCapitalPiece(enemyColor);
        travelCost = thisGame.distanceBewteenPoints(pieceOrigin.boardPoint, enemyCapital.boardPoint);
    }
    return travelCost;
}


function getFrigateMoveScore(thisGame, piece, unit, enemyColor, primaryTargetColors)
{
    let score = 0;
    const hasEnemyFrigate = piece.hasFrigate(enemyColor);
    if (unit.hasUnloadables())
    {
        // Loaded frigates should move toward enemy coastal towns.
        const enemyCivs = thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor);
        let coastalCivs = [];
        for (const civPiece of enemyCivs)
        {
            if (isAccessibleNow(civPiece, unit, true) || (hasAdjacentDeepWater(thisGame, unit.piece)  && hasAdjacentDeepWater(thisGame, civPiece)))
            {
                coastalCivs.push(civPiece);
            }
        } 
        const targetCivs = coastalCivs.length > 0 ? coastalCivs : enemyCivs;
        const distance = getDistanceToNearestFrigateTarget(thisGame, targetCivs, piece);
        const distanceScalar = distance > 0 ? 1 - (0.1 * distance) : 1;
        score = 0.7 * distanceScalar;
        const defenderCount = piece.countOpponentMilitary(thisGame.perspectiveColor); 
        const defensiveScalar = defenderCount > 0 ? 1 - (0.03125 * defenderCount) : 1; 
        const hitTarget = distance === 0;
        score += hitTarget && primaryTargetColors.includes(enemyColor) ? 0.125 * defensiveScalar : 0;
        score -= hitTarget && (hasAdjacentEnemyArmy(thisGame, piece) || hasAdjacentEnemyFrigate(thisGame, piece)) ? 0.01125 : 0;
        score -= hasEnemyFrigate ? 0.03125 : 0;
        score += piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) ? 
            isAdjacent(thisGame, unit.piece.boardPoint, piece.boardPoint) ? 0.125 : 0.09375 : 0;
        score += piece.hasOpponentTown(thisGame.perspectiveColor) && !piece.isMountain() ? 0.0625 : 0;
        score += piece.hasOpponentCivilization(thisGame.perspectiveColor) ? 0.03125 : 
                piece.isMountain() ? 0.01875 : piece.isForest() ? 0.01125 : 0;
    }
    else
    {
        // Unloaded frigates should support friendlies.
        let friendlyArmyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
        if (friendlyArmyUnits)
        {
            const distance = getDistanceToNearestUnit(thisGame, friendlyArmyUnits, piece);
            const distanceScalar = distance > 1 ? (1 - 0.1 * distance) : 1;
            score = 0.77 * distanceScalar;
        }
        const adjacentFriendlyCivCount = countAdjacentCivilizations(thisGame, piece)
        score += adjacentFriendlyCivCount ? 0.03 * adjacentFriendlyCivCount : 0;
        score += hasAdjacentEnemyTown(thisGame, piece) ? 0.07 : 0;
        if (hasEnemyFrigate && piece.findFrigate(enemyColor).hasUnloadables())
        {
            score += 0.0625;
        }
        score += hasAdjacentEnemyArmy(thisGame, piece) ? 0.03125 : 0;
    }
    // Add small weight for other considerations.
    score += hasAdjacentBattle(thisGame, piece) ? 0.03125 : hasAdjacentEnemyArmy(thisGame, piece) ? 0.01125: 0;
    // Clamp to [0,2]. Values should hit between about [0,1], but an overflow capacity may be useful.
    score = score < 0 ? 0 : score > 2 ? 2 : score;
    return score;
}


function hasReachableEnemy(thisGame, unit, viaImaginaryCargo)
{
    for (const piece of thisGame.pieces)
    {
        if (piece.hasRollingOpponent(thisGame.perspectiveColor))
        {
            if (isAccessibleNow(piece, unit, viaImaginaryCargo))
            {
                return true;
            }
        }
    }
    return false;
}


function isNotOverkill(thisGame, piece)
{
    const defenderUnitCount = piece.countOpponentMilitary(thisGame.perspectiveColor);
    const attackerUnitCount = piece.getMilitaryUnitCount(thisGame.perspectiveColor);
    let isOverkill = null;
    if (defenderUnitCount === 0 && (piece.hasOpponentCity(thisGame.perspectiveColor) || piece.terrainDefenses() === 2) && attackerUnitCount > 3)
    {
        isOverkill = true;
    }
    else if (defenderUnitCount === 0 && piece.hasOpponentTown(thisGame.perspectiveColor) && attackerUnitCount > 2)
    {
        isOverkill = true;
    }
    else if (defenderUnitCount === 1 && !piece.hasOpponentArtillery(thisGame.perspectiveColor) && !piece.isMountain() && !piece.hasOpponentCivilization(thisGame.perspectiveColor) && attackerUnitCount > 1)
    {
        isOverkill = true;
    }
    else
    {
        const enemyColor = piece.getOpponentColor(thisGame.perspectiveColor);
        const defenderRollCount = piece.numDefenderRolls(enemyColor);
        const defenderPower = (2 * defenderRollCount) + defenderUnitCount;
        const attackerRollCount = piece.numAttackerRolls(thisGame.perspectiveColor);
        const attackerPower = (2 * attackerRollCount) + attackerUnitCount;
        isOverkill = defenderPower < attackerPower * 0.75 ? true : false;
    }
    return !isOverkill;
}


function calculateDefensivePower(thisGame, piece, color)
{
    if (!color)
    {
        color = thisGame.perspectiveColor;
    }
    const civDefenderCount = piece.getMilitaryUnitCount(color);
    const civRollCount = piece.numDefenderRolls(color);
    return (civDefenderCount ? (2 * civRollCount) + civDefenderCount : piece.hasCity(color) ? 2 : 1);
}


function guessThreat(thisGame, piece)
{
    // Use temporary pennants for terrain simulation.
    const enemyColors = getEnemyColors(thisGame);
    for (const color of enemyColors)
    {
        thisGame.pieces.addNeededPennants(color, color, false);
    }
    // Guess threat on simulated terrain.
    let threat = guessArmyThreat(thisGame, piece, enemyColors);
    for (const color of enemyColors)
    {
        thisGame.pieces.removePennants(color, false);
    }
    const enemyFrigates = findFrigates(thisGame, enemyColors);
    for (const frigate of enemyFrigates)
    {
        // Possible todo: count all units that can be carried to target, not just cargo & adjacents, without any double-count.
        const hasCargo = frigate.cargo.length > 0;
        const hasAdjacentLoadableArmy = hasAdjacentEnemyArmy(thisGame, frigate.piece);
        if (!hasCargo && !hasAdjacentLoadableArmy)
        {
            continue;                
        }
        let amphibArmyCount = 0;
        // If necessary, add some dummy cargo to get all possible landing points.
        maybeAddImaginaryCargo(frigate, hasCargo);
        const inRangePoints = getFrigateMovables(frigate);
        removeImaginaryCargo(frigate);    
        if (!inRangePoints)
        {
            continue;
        }
        for (const point of inRangePoints)
        {
            if (point.x === piece.boardPoint.x && point.y === piece.boardPoint.y)
            {
                if (hasCargo)
                {
                    amphibArmyCount += frigate.cargo.length;
                    if (!threat.hasInfantry && frigate.carriesCargo("i"))
                    {
                        threat.hasInfantry = true
                    }
                    if (!threat.hasCavalry && frigate.carriesCargo("c"))
                    {
                        threat.hasCavalry = true;
                    }
                    if (!threat.hasArtillery && frigate.carriesCargo("a"))
                    {
                        threat.hasArtillery = true;
                    }
                }
                const frigateCapacity = 3;
                let adjacentEnemyArmyCount = 0;
                let hasFullLoadPotential = false;
                if (amphibArmyCount < frigateCapacity && hasAdjacentLoadableArmy)
                {
                    const adjacentPieceIndices = frigate.piece.getAdjacentIndecies(1);
                    for (const adjacentPieceIndex of adjacentPieceIndices)
                    {
                        adjacentEnemyArmyCount += thisGame.pieces[adjacentPieceIndex].countOpponentMilitary(thisGame.perspectiveColor);
                        if (adjacentEnemyArmyCount + amphibArmyCount >= frigateCapacity)
                        {
                            hasFullLoadPotential = true;
                            break;
                        }
                    }
                    amphibArmyCount = hasFullLoadPotential ? frigateCapacity : amphibArmyCount + adjacentEnemyArmyCount;
                }
                // Frigate threat confirmed, so skip other inRangePoints.
                break; 
            } // End if point === piece.boardPoint
        } // End for each point
        threat.count += amphibArmyCount;
    } // End for each frigate
    // Estimate likely number of rolls, based on enemy count & type.
    const attackVectorBonus = threat.count < 2 ? 0 : threat.count < 4 ? 1 : threat.count < 6 ? 2 : threat.count < 10 ? 3 : 4;
    const threatRollCount = attackVectorBonus + threat.hasInfantry + threat.hasCavalry + threat.hasArtillery;
    // Weight to favor rolls and combine to estimate threat.
    return ((2 * threatRollCount) + threat.count);
}


function maybeAddImaginaryCargo(frigate, hasCargo)
{
    if (!hasCargo)
    {
        frigate.cargo = "romulanAle";
    }
}


function removeImaginaryCargo(frigate)
{
    if (frigate.cargo === "romulanAle")
    {
        frigate.cargo = "";
    }
}


function guessArmyThreat(thisGame, piece, enemyColors)
{
    let threat = {count: 0, hasInfantry: false, hasCavalry : false, hasArtillery: false};
    let enemyArmyUnits = getArmyUnits(thisGame, enemyColors);
    if (!enemyArmyUnits)
    {
        return threat;
    }
    for (const unit of enemyArmyUnits)
    {
        let inRangePoints = guessInRangePoints(thisGame, unit);
        if (!inRangePoints)
        {
            continue;
        }
        for (const point of inRangePoints)
        {
            if (point.x === piece.boardPoint.x && point.y === piece.boardPoint.y)
            {
                threat.count++;
                if (!threat.hasInfantry && unit.isInfantry())
                {
                    threat.hasInfantry = true
                    break;
                }
                if (!threat.hasCavalry && unit.isCavalry())
                {
                    threat.hasCavalry = true;
                    break;
                }
                if (!threat.hasArtillery && unit.isArtillery())
                {
                    threat.hasArtillery = true;
                    break;
                }
                break;
            }
        }
    }
    return threat;
}


function guessInRangePoints(thisGame, unit)
{
    let isWorldExplored = true; 
    for (const piece of thisGame.pieces)
    {
        const reserveIndex = thisGame.pieces.length - 1;
        if (piece.index === reserveIndex)
        {
            continue;
        }
        if (piece.hidden === true)
        {
            isWorldExplored = false;
            break;
        }
    }
    if (isWorldExplored)
    {
        return unit.getMovables();
    }
    // Modify "getMovables" helper function to include any visible piece in range.
    // Allows threat assessment to include threats adjacent to unexplored terrain.
    const stash = GamesByEmail.Viktory2Piece.prototype.allAdjacentsVisible;
    GamesByEmail.Viktory2Piece.prototype.allAdjacentsVisible = function ()
    {
        // Only check if the current piece is visible.
        return (this.hidden === false);
    }   
    let inRangePoints = unit.getMovables();
    // Restore original function.
    GamesByEmail.Viktory2Piece.prototype.allAdjacentsVisible = stash;
    return inRangePoints;
}


function getDistanceToNearestUnit(thisGame, units, originPiece)
{
    let minDistance = Number.MAX_VALUE;
    for (const unit of units)
    {
        const distance = thisGame.distanceBewteenPoints(unit.piece.boardPoint, originPiece.boardPoint);
        if (distance < minDistance)
        {
            minDistance = distance;
        }
    }
    return minDistance;
}


function getDistanceToNearestFrigateTarget(thisGame, enemyCivs, originPiece)
{
    let distance = -1;
    let minDistance = Number.MAX_VALUE;
    for (const civPiece of enemyCivs)
    {
        distance = thisGame.distanceBewteenPoints(civPiece.boardPoint, originPiece.boardPoint);
        if (distance < minDistance)
        {
            minDistance = distance
        }
    }
    return minDistance;
}


function decideMoveAcceptance(thisGame, unit, destinationIndex)
{
    if (unit.piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.color))
    {
        return false;
    }
    const destinationPiece = thisGame.pieces[destinationIndex];
    if (unit.isFrigate())
    {
        return decideFrigateMoveAcceptance(thisGame, unit, destinationPiece);
    }
    // Consider guarding a beseiged town vs attacking.
    const defenderCount = unit.piece.getMilitaryUnitCount(thisGame.perspectiveColor);
    const isPinned = unit.piece.hasAdjacentRollingEnemy(thisGame.perspectiveColor, thisGame.player.team.rulerColor);
    if (isPinned && unit.piece.hasCivilization(thisGame.perspectiveColor))
    {
        // Going to own capital or from own capital to fight is always approved.
        if (destinationPiece.hasCapital(thisGame.perspectiveColor) || 
            ( unit.piece.hasCapital(thisGame.perspectiveColor) && ( destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) || isManeuveringToAttack || destinationPiece.hasFrigate(thisGame.perspectiveColor))))
        {
            return true;
        }
        // Pinned defending cavalry will likely be allowed to join any battle that doesn't have friendly cavalry or to attack an unguarded town.
        const unguarded = destinationPiece.countOpponentMilitary(thisGame.perspectiveColor) === 0;
        if (unit.type === "c" && destinationPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor && !destinationPiece.hasCavalry(thisGame.perspectiveColor)) ||
            unit.isCavalry() && destinationPiece.hasOpponentTown(thisGame.perspectiveColor) && unguarded)
        {
            return Math.random() < 0.8 ? true : false;
        }
        // Otherwise, for last pinned defenders:
        if (defenderCount === 1)
        {
            const attackingToBreakSiege = (destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) && isAdjacent(thisGame, unit.piece.boardPoint, destinationPiece.boardPoint)) || window.isManeuveringToAttack === true;
            if (attackingToBreakSiege && hasAdjacentSupport(thisGame, unit.piece) && hasWeakPin(thisGame, unit.piece))
            {
                return true;
            }
            else if (unit.isInfantry() || unit.isCavalry())
            {
                unit.holding = true;
                window.holdingUnits.push(unit);
                return false;
            }
            else
            {
                unit.movementComplete = true;
                return false;
            }
        }
        if (defenderCount === 2 && unit.isInfantry())
        {
            if (unit.piece.hasCavalry(thisGame.perspectiveColor) || unit.piece.hasArtillery(thisGame.perspectiveColor))
            {
                unit.holding = true;
                window.holdingUnits.push(unit);
                return false;
            }
        }
        const isNotAttacking = (!isManeuveringToAttack && !destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) && !destinationPiece.hasFrigate(thisGame.perspectiveColor));
        if (isVulnerable(thisGame, unit.piece) && (isNotAttacking || !isAdjacent(thisGame, unit.piece.boardPoint, destinationPiece.boardPoint)))
        {
            if (unit.isInfantry() || unit.isCavalry())
            {
                unit.holding = true;
                window.holdingUnits.push(unit);
                return false;
            }
            else
            {
                unit.movementComplete = true;
                return false;
            }
        }
        
    }
    else if (shouldPinnedInfantryHoldHighGround(thisGame, unit, isPinned, defenderCount, destinationPiece))
    {
        unit.holding = true;
        window.holdingUnits.push(unit);
        return false;
    }
    // Default case: accept move.
    return true;
}


function decideFrigateMoveAcceptance(thisGame, unit, destinationPiece)
{
    // Loaded frigates may always move.
    if (unit.hasUnloadables())
    {
        return true;
    }
    else
    {
        // Frigates that can bombard an adjacent battle should stay.
        if (hasAdjacentBattle(thisGame, unit.piece) && hasAdjacentEnemyArmy(thisGame, unit.piece))
        {
            unit.movementComplete = true;
            return false;
        }
        // When a frigate pins an enemy town, only move for a battle or to another pin.
        const pinsEnemyTown = hasAdjacentEnemyTown(thisGame, unit.piece);
        const movingToPin =  hasAdjacentEnemyTown(thisGame, destinationPiece);
        const movingToBattle = hasAdjacentBattle(thisGame, destinationPiece);
        if (pinsEnemyTown && !movingToPin && !movingToBattle)
        {
            unit.movementComplete = true;
            return false;
        }
        // When a frigate guards a threatened friendly civ, only move for a battle.
        if (hasAdjacentFriendlyCiv(thisGame, unit.piece))
        {
            const adjacentCiv = findAdjacentFriendlyCiv(thisGame, unit.piece);  // Todo: maybe find all.
            if (hasThreat(thisGame, adjacentCiv) && !hasAdjacentBattle(thisGame, destinationPiece))
            {
                unit.movementComplete = true;
                return false;
            }
        }
    }
    return true;
}


function shouldPinnedInfantryHoldHighGround(thisGame, unit, isPinned, defenderCount, destinationPiece)
{
    return (isPinned && unit.piece.isMountain() && unit.isInfantry() && defenderCount === 1 && 
    !isManeuveringToAttack && !destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) && !destinationPiece.hasFrigate(thisGame.perspectiveColor) &&
    !(destinationPiece.hasCivilization(thisGame.perspectiveColor) && hasAdjacentEnemyArmy(thisGame, destinationPiece) && hasGraveDanger(thisGame, destinationPiece)));
}


function hasAdjacentSupport(thisGame, adjacentPiece)
{
    const adjacentPieceIndices = adjacentPiece.getAdjacentIndecies(1);
    for (const adjacentPieceIndex of adjacentPieceIndices)
    {
        let adjacentPiece = thisGame.pieces[adjacentPieceIndex];
        if (adjacentPiece.getMilitaryUnitCount(thisGame.perspectiveColor))
        {
            return true;
        }
    }
    return false;
}


function hasWeakPin(thisGame, piece)
{
    let enemyCount = 0;
    const adjacentPieceIndices = piece.getAdjacentIndecies(1);
    for (const adjacentPieceIndex of adjacentPieceIndices)
    {
        const adjacentPiece = thisGame.pieces[adjacentPieceIndex];
        enemyCount += adjacentPiece.countOpponentMilitary(thisGame.perspectiveColor);
        if (enemyCount > 1)
        {
            return false;
        }
    }
    return true;
}


function isVulnerable(thisGame, piece)
{
    const defensivePower = calculateDefensivePower(thisGame, piece);
    const threat = guessThreat(thisGame, piece);
    return defensivePower < threat;
}


function clearHoldingUnits()
{
    for (let unit of window.holdingUnits)
    {
        unit.holding = false;
    }
    window.holdingUnits = [];
}


function bombard(thisGame, unit, bombardablePoints)
{
    const fireDelay = 300;
    setTimeout(function(){
        bombardUnitsSimulateMouseDown(thisGame, unit);
        const targetPoint = getBestTargetPoint(thisGame, bombardablePoints);
        const targetPiece = thisGame.pieces.findAtPoint(targetPoint);
        const targetScreenPoint = targetPiece.$screenRect.getCenter();
        setTimeout(function(){
            const hasFired = bombardUnitsSimulateMouseUp(thisGame, targetScreenPoint);
            if (hasFired)
            {
                const commitDelay = 600;
                setTimeout(function(){
                    thisGame.overlayCommitOnClick();
                    setTimeout(function(){ replaceBattleMessage() }, 16);
                    // Apply hits.
                    const applyHitsDelay = 200;
                    setTimeout(function(){
                        replaceBattleMessage();
                        if (thisGame.battleData)
                        {
                            const data = thisGame.getBattleData();
                            if (data && data.piece.defenderBattleInfo &&
                                data.piece.defenderBattleInfo.decisionNeeded)
                            {
                                applyHits(thisGame, data.piece.index, data, true);
                            }
                        }
                        const reviewDelay = 800;
                        // Unit reference is unreliable, so set properties via the game.
                        thisGame.pieces[unit.piece.index].units[unit.index].hasBombarded = true;
                        thisGame.pieces[unit.piece.index].units[unit.index].noBombard = true;
                        thisGame.pieces[unit.piece.index].updateUnitDisplay()
                        setTimeout(function(){
                            thisGame.pieces[targetPiece.index].bombardOkClick(thisGame.player.team.color);
                            window.isBombarding = false;
                            console.log("Bombardment!");
                            runKomputer(thisGame);
                        }, reviewDelay)
                    }, applyHitsDelay);
                }, commitDelay);
            } // End if hasFired
            else
            {
                // Rare case: failure to fire indicates some abnormal interferance, so stop trying to fire.
                unit.hasBombarded = true;
                unit.noBombard = true;
                window.isBombarding = false;
                runKomputer(thisGame);
            }
        }, fireDelay);
    }, fireDelay)
}


function getBestTargetPoint(thisGame, bombardablePoints)
{
    let secondaryTarget = null;
    for (const bombardablePoint of bombardablePoints)
    {
        const piece = thisGame.pieces.findAtPoint(bombardablePoint);
        if (piece)
        {
            if (piece.hasBattle(thisGame.player.team.color, thisGame.player.team.rulerColor) && piece.hasNonRulingOpponentMilitary(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
            {
                return bombardablePoint;
            }
            if (thisGame.pieces[piece.index].countMilitaryUnits(piece.units) === 1)
            {
                secondaryTarget = bombardablePoint;
            }
        }
    }
    return secondaryTarget ? secondaryTarget : getRandomItem(bombardablePoints);
}


function findNextBattle(thisGame)
{
    for (let piece of thisGame.pieces)
    {
        if (piece.hasBattle(thisGame.player.team.color, thisGame.player.team.rulerColor))
        {
            return piece;
        }
    }
    return null;
}


function fightBattle(thisGame, battlePiece, isReserveBattle = false)
{
    commitExploration(thisGame);
    selectBattle(thisGame, battlePiece);
    ensureMovementComplete(thisGame, battlePiece);
    hideEndTurnButtons();
    // Do prebattle artillery.
    if (document.getElementById("Foundation_Elemental_" + gameVersion + "_battleOk"))
    {
        battlePiece.preBattleOkClick(thisGame.player.team.color);
    }
    // Roll loop
    const rollDelay = 400;
    setTimeout(function roll(){
        thisGame.overlayCommitOnClick();
        setTimeout(replaceBattleMessage, 100);
        // Apply hits.
        const applyHitsDelay = 400;
        setTimeout(function(){
            replaceBattleMessage();
            if (thisGame.battleData)
            {
                const data = thisGame.getBattleData();
                if (data && data.piece.attackerBattleInfo &&
                    data.piece.attackerBattleInfo.decisionNeeded ||
                    data.piece.defenderBattleInfo &&
                    data.piece.defenderBattleInfo.decisionNeeded)
                {
                    applyHits(thisGame, battlePiece.index, data);
                }
            }
            // Roll again or close after review, then continue game / find next battle.
            const battleReviewDelay = 1600;
            hideEndTurnButtons();
            setTimeout(function(){
                const hasNotWonGame = thisGame.movePhase !== 0; 
                if (hasNotWonGame)
                {
                    // Caution - this is a "gotcha" bug waiting to happen, as it happened twice already.
                    // Don't shorten below to: battlePiece.battleOkClick(thisGame.perspectiveColor);
                    // The battlePiece object is no longer a reference to the game piece! 
                    // Many bothans died to bring us this information.
                    thisGame.pieces[battlePiece.index].battleOkClick(thisGame.player.team.color);
                    const reRollDelay = 1200;
                    hideEndTurnButtons();
                    replaceBattleMessage();
                    setTimeout(function(){
                        if (document.getElementById("Foundation_Elemental_" + gameVersion + "_overlayCommit"))
                        {
                            roll();
                        }
                        else
                        {
                            if (isReserveBattle)
                            {
                                // Clear the reserve interval now to prevent the Komputer from replaying a reserve battle.
                                // Also prevents stopping the Komputer manually, until the turn is over - likely a couple seconds away. 
                                hideEndTurnButtons()
                                setTimeout(function(){
                                    const battleReview = document.getElementById("Foundation_Elemental_" + gameVersion + "_battleOk");
                                    if (battleReview)
                                    {
                                        thisGame.pieces[battlePiece.index].battleOkClick(thisGame.player.team.color);
                                    }
                                    window.hasBattleBegun = false;
                                    hideEndTurnButtons();
                                    setTimeout(function()
                                    {
                                        // Check for more reserve battles, which are rare, but possible.
                                        maybeFightReserveBattle(thisGame);
                                        if (!thisGame.hasBattlesPending && !window.hasBattleBegun)
                                        {
                                            endReservePhase(thisGame);
                                        }
                                    }, 200);
                                }, battleReviewDelay);
                            }
                            else
                            {
                                // After battle
                                thisGame.update();
                                window.hasBattleBegun = false;
                                runKomputer(thisGame);
                            }
                        }
                    }, reRollDelay);
                }
                // Game won. Reset for start.
                else
                {
                    thisGame.maxMoveNumber = 0;
                    window.isKomputerReady = true;
                    resetKomputerButtonStyle(true);
                    console.log("Viktory.");
                }
            }, battleReviewDelay);
        }, applyHitsDelay);
    }, rollDelay);
}


function commitExploration(thisGame)
{
    const explorationPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_overlayCommit");
    const endTurnCommit = document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyTurn");
    if (explorationPopup && !endTurnCommit)
    {
        thisGame.overlayCommitOnClick();
        return true;
    }
    return false;
}


function selectBattle(thisGame, battlePiece)
{
    if (!window.hasBattleBegun)
    {
        window.hasBattleBegun = true;
        thisGame.moveUnitsMouseDown(battlePiece.$screenRect.getCenter());
    }
}


function replaceBattleMessage()
{
    let battleMessage = document.querySelector("#Foundation_Elemental_" + gameVersion + "_centerOverPiece > tbody > tr:nth-child(3) > td");
    if (battleMessage && battleMessage.innerText.substr(0, 3) === "You")
    {
        battleMessage.innerText = "The Komputer " + battleMessage.innerText.substr(3);
    }
}


function applyHits(thisGame, pieceIndex, battleData, isBombarding = false)
{
    const thisPiece = thisGame.pieces[pieceIndex];
    const attackerColor = thisGame.player.team.color;
    const defenderColor = thisGame.pieces[pieceIndex].getOpponentColor(thisGame.perspectiveColor);
    const attackerHitThreshold = thisGame.getHitThreshold(attackerColor);
    const defenderHitThreshold = thisGame.getHitThreshold(defenderColor);
    const attackerUnitList = thisPiece.getMilitaryUnitList(attackerColor);
    const defenderUnitList = thisPiece.getDefenderUnitList(defenderColor);
    thisPiece.defenderBattleInfo = thisPiece.getBattleInfo(defenderUnitList, battleData.attackerRolls, attackerHitThreshold,true);
    // Choose highest value hits on the defender.
    if (thisPiece.defenderBattleInfo.decisionNeeded)
    {
        const hitCount = thisPiece.defenderBattleInfo.numTacticalHit;
        thisPiece.hitHighestMilitaryUnits(defenderUnitList, hitCount, false);
    }
    // Check if attackers are present, since attackers may be bombarding.
    if (attackerUnitList && attackerUnitList.length > 0)
    {
        thisPiece.attackerBattleInfo = thisPiece.getBattleInfo(attackerUnitList, battleData.defenderRolls, defenderHitThreshold,false);
        // Choose lowest value hits on the attacker.
        if (thisPiece.attackerBattleInfo.decisionNeeded)
        {
            const hitCount = (thisPiece.attackerBattleInfo.numHit - thisPiece.attackerBattleInfo.numTacticalHit);
            thisPiece.hitLowestMilitaryUnits(attackerUnitList, hitCount, false);
        }
    }
    setTimeout(function(){
        if (isBombarding)
        {
            thisPiece.bombardOkClick(attackerColor);
        }
        else
        {
            thisPiece.battleOkClick(attackerColor);
        }
    }, 400);
}


async function placeReserves(thisGame)
{
    clearIntervalsAndTimers();
    window.reserveIntervalId = await setInterval(placeReserveUnit, 1200, thisGame);
}


function placeReserveUnit(thisGame)
{
    ensureValidBoard(thisGame);
    if (window.stopKomputer === true)
    {
        stopAndReset();
        return;
    }
    if (window.hasBattleBegun || window.isExploring)
    {
        return;
    }
    hideEndTurnButtons();
    const reserveUnits = thisGame.player.team.reserveUnits;
    const controlsCapital = thisGame.doesColorControlTheirCapital(thisGame.player.team.color);
    let hasPlayableReserveUnit = false;
    if (thisGame.movePhase === 11 && reserveUnits.length > 0)
    {
        for (let i = 0; i < reserveUnits.length; i++)
        {
            if (thisGame.couldPlaceReserveUnit(reserveUnits[i], thisGame.player.team.color, controlsCapital))
            {
                const element = document.querySelector("#Foundation_Elemental_" + gameVersion + "_reserve_" + i);
                thisGame.reserveOnMouseDown(element, thisGame.event("reserveOnMouseDown(this,event,#)"), i);
                hasPlayableReserveUnit = true;
                break;
            }
        }
    }
    if (hasPlayableReserveUnit)
    {
        // Place reserve unit.
        const movingUnitType = thisGame.pieces.getNewPiece().movingUnit.type;
        const destinationBoardPoint = (movingUnitType === "t" || movingUnitType === "y") ? (
            getBestBuildable(thisGame) ) : (
            getBestReservable(thisGame, movingUnitType, controlsCapital) );
        const destinationScreenPoint = thisGame.screenRectFromBoardPoint(destinationBoardPoint).getCenter();
        thisGame.placeReserveOnMouseUp(destinationScreenPoint);
        hideEndTurnButtons();
        // Maybe settle exploration.
        if (document.getElementById("Foundation_Elemental_" + gameVersion + "_overlayCommit") &&
            !document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyTurn"))
        {
            clearIntervalsAndTimers();
            settleCivExploredTerrain(thisGame, destinationBoardPoint);
        }
    }
    // End placing reserves. 
    else
    {
        clearInterval(window.reserveIntervalId);
        ensureValidBoard(thisGame);
        maybeRecallTroops(thisGame);
        maybeRecallFrigatesToPort(thisGame);
        maybeFightReserveBattle(thisGame);
        if (!thisGame.hasBattlesPending && !hasBattleBegun)
        {
            setTimeout(function(){ endReservePhase(thisGame) }, 200);
        }
    }
}


function settleCivExploredTerrain(thisGame, civBoardPoint)
{
    window.isExploring = true;
    thisGame.overlayCommitOnClick();
    setTimeout(function()
    {
        const hexTerrain = thisGame.getMapCustomizationData();
        if (hexTerrain.length > 0)
        {
            const waterPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_waterSwap");
            const isEarlyGame = thisGame.maxMoveNumber < 16;
            if ((waterPopup && isEarlyGame) || 
                (waterPopup && (Math.random() < 0.2)))
            {
                thisGame.swapWaterForLand();
                console.log("Water swap!");
            }
            const civPiece = thisGame.pieces.findAtPoint(civBoardPoint);
            if(isSmallBoard && (civPiece.index === 7 || civPiece.index === 36) ||
                isLargeBoard && (civPiece.index === 9 || civPiece.index === 62))
            {
                thisGame.playOptions.mapCustomizationData = hexTerrain.split('').reverse().join('');
            }
            else if (hexTerrain.length > 1)
            {
                const newHexOrder = decideHexOrder(thisGame, hexTerrain, civBoardPoint);
                thisGame.playOptions.mapCustomizationData = newHexOrder;
            }                
            setTimeout(function(){
                thisGame.customizeMapDoAll(true);
                setTimeout(function()
                {
                    window.isExploring = false;
                    runKomputer(thisGame);
                }, 128);
            }, 600);
        }
        else
        {
            window.isExploring = false;
            runKomputer(thisGame);
        }
    }, 128);
}


function ensureValidBoard(thisGame)
{
    const invalidPiece = thisGame.pieces.findByBoardValue("l");
    if (invalidPiece)
    {
        fixPiecesPendingValue(thisGame, invalidPiece);
    }   
}


function endReservePhase(thisGame)
{
    clearIntervalsAndTimers();
    if (window.currentPlayerTurn === thisGame.perspectiveColor)
    {
        thisGame.moveToNextPlayer();
        thisGame.sendMove();
    }
    window.hasBattleBegun = false;
    setTimeout(function()
    {
        window.isKomputerReady = true;
        resetKomputerButtonStyle(false);
        console.log("Done.");
    }, 200)
}


function maybeFightReserveBattle(thisGame)
{
    if (thisGame.hasBattlesPending && !window.hasBattleBegun)
    {
        const battlePiece = findNextBattle(thisGame);
        if (battlePiece)
        {
            console.log("Handling reserve battle.");
            fightBattle(thisGame, battlePiece, true);
        }
    }    
}


function getBestBuildable(thisGame)
{
    let buildablePoints = thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor);
    // For the early game, return a point closest to center, preferably on rough terrain with access to water.
    const isEarlyGame = thisGame.pieces.getCivilizations(thisGame.perspectiveColor).length < 3;  
    if (isEarlyGame)
    {
        return getStrongPointCloseToCenter(thisGame, buildablePoints);
    }
    // Return any closest threatened town point.
    const buildablePieces = [];
    sortByClosestToEnemy(thisGame, buildablePoints);
    for (const point of buildablePoints)
    {
        const piece = thisGame.pieces.findAtPoint(point);
        if (piece.hasTown(thisGame.perspectiveColor))
        {
            if (hasThreat(thisGame, piece))
            {
                return point;
            }
        }
        buildablePieces.push(piece);
    }
    // Build map central towns first, with priority on weaker towns.
    const centralIndices = [21, 22, 29, 30, 31, 38, 39];
    let centralPieceChoices = [];
    let centralPointChoices = [];
    let bestCentralPoint = null;
    for (let i = 0; i < buildablePieces.length; i++)
    {
        if (centralIndices.includes(buildablePieces[i].index))
        {
          centralPieceChoices.push(buildablePieces[i]);
          centralPointChoices.push(buildablePoints[i]);
        }
    }
    if (centralPointChoices.length > 0)
    {
        const terrainPriorities = ['w','m', 'p', 'g', 'f'];
        let bestTerrain = 'w';
        let bestIndex = 0;
        let iteratorIndex = 0;
        for (const piece of centralPieceChoices)
        {
            if (!piece.hasTown(thisGame.perspectiveColor))
            {
                return centralPointChoices[iteratorIndex];
            }
            if (terrainPriorities.indexOf(bestTerrain) < terrainPriorities.indexOf(piece.boardValue))
            {
                bestTerrain = piece.boardValue;
                bestIndex = iteratorIndex;
            }
            iteratorIndex++;
        }
        bestCentralPoint = centralPointChoices[bestIndex];
    }
    // Note which terrain types are occupied.
    const civilizations = thisGame.pieces.getCivilizations(thisGame.perspectiveColor);
    let hasMountain = false;
    let hasGrass = false;
    let hasForest = false;
    let hasPlain = false;
    for (const civ of civilizations)
    {
        if (civ.isPlain())
        {
            hasPlain = true;
        }
        else if (civ.isGrassland())
        {
            hasGrass = true;
        }
        else if (civ.isForest())
        {
            hasForest = true;
        }
        else if (civ.isMountain())
        {
            hasMountain = true;
        }
        // When occupying one of each terrain type, focus on the center or a point closest to the enemy.
        if (hasPlain && hasGrass && hasForest && hasMountain)
        {
            return bestCentralPoint ? bestCentralPoint : buildWingsBeforeTail(thisGame, buildablePoints, buildablePoints[0]);
        }
    }
    // Else return a terrain type not yet occupied, farthest from the enemy.
    buildablePoints.reverse();
    let terrainPoint = null;
    if (!hasForest)
    {
        terrainPoint = findTerrain(thisGame, buildablePoints, "f")
        if (terrainPoint)
        {
            return terrainPoint;
        }
    }
    if (!hasMountain)
    {
        terrainPoint = findTerrain(thisGame, buildablePoints, "m")
        if (terrainPoint)
        {
            return terrainPoint;
        }
    }
    if (!hasGrass)
    {
        terrainPoint = findTerrain(thisGame, buildablePoints, "g")
        if (terrainPoint)
        {
            return terrainPoint;
        }
    }
    if (!hasPlain)
    {
        terrainPoint = findTerrain(thisGame, buildablePoints, "p")
        if (terrainPoint)
        {
            return terrainPoint;
        }
    }
    // Default (no new terrain): roughly choose midway forward to the front lines.
    // If default already has a town, try to reinforce a central point, then build up wings before the tail.
    const defaultPoint = buildablePoints[Math.floor(buildablePoints.length * 0.75)];
    return (bestCentralPoint && thisGame.pieces.findAtPoint(defaultPoint).hasTown(thisGame.perspectiveColor)) ? 
        bestCentralPoint : buildWingsBeforeTail(thisGame, buildablePoints, defaultPoint);
}


function getStrongPointCloseToCenter(thisGame, buildablePoints)
{
    const centerPoint = getCenterPieceBoardPoint(thisGame);
    const isPlayingRed = thisGame.perspectiveColor === 0;
    const isCenterTownRed = thisGame.pieces.findAtPoint(centerPoint).hasTown(thisGame.perspectiveColor);
    let minDistance = Number.MAX_VALUE;
    let strongPoint = null;
    let primaryTargetFound = false;
    for (let index = 0; index < buildablePoints.length; index++)
    {
        const manhattanDistance = thisGame.distanceBewteenPoints(centerPoint, buildablePoints[index]);
        const isExactCenter = manhattanDistance === 0;
        if (isSmallBoard && isExactCenter)
        {
            // If the exact center is strong (a rare case), take it.
            if (isCenterStrong(thisGame))
            {
                strongPoint = buildablePoints[index];
                break;
            }
            // Otherwise, try to skip the center.
            const hasOtherOptions = buildablePoints.length > 1;
            if (hasOtherOptions)
            {
                continue;   
            }
        }
        // Look for Red's primary targets.
        if (isSmallBoard && isPlayingRed)
        {
            if (isCenterTownRed)
            {
                if (isCenterSupportHexAvailable(thisGame, buildablePoints, index))
                {
                    strongPoint = buildablePoints[index];
                    primaryTargetFound = true;
                }
            }
            else if (isWedgeHexAvailable(thisGame, buildablePoints, index))
            {
                const wedgeFlankCenter = thisGame.pieces[22];
                if (wedgeFlankCenter.hidden || countAdjacentInlandSea(thisGame, wedgeFlankCenter) < 3)
                {
                    strongPoint = buildablePoints[index];
                    primaryTargetFound = true;
                }
            }        
        }
        // Look for hexes closest to the center.
        if (!primaryTargetFound && manhattanDistance < minDistance)
        {
            minDistance = manhattanDistance;
            strongPoint = buildablePoints[index];
        }
        // Break ties by terrain and water access.
        else if (!primaryTargetFound && manhattanDistance === minDistance)
        {
            let strongPointPiece = thisGame.pieces.findAtPoint(strongPoint);
            const strongPointDefenses = strongPointPiece.terrainDefenses();
            const strongPointAdjacentWaterCount = countAdjacentInlandSea(thisGame, strongPointPiece);
            const strongPointShipyardBonus = (strongPointDefenses === 1 && strongPointAdjacentWaterCount > 2) ? 2 : 0;
            const otherPointPiece = thisGame.pieces.findAtPoint(buildablePoints[index]);
            const otherPointDefenses = otherPointPiece.terrainDefenses();
            const otherPointAdjacentWaterCount = countAdjacentInlandSea(thisGame, otherPointPiece);
            const otherPointShipyardBonus = (otherPointDefenses === 1 && strongPointAdjacentWaterCount > 2) ? 2 : 0;
            const strongPointComboStrength = strongPointDefenses + strongPointAdjacentWaterCount + strongPointShipyardBonus;
            const otherPointComboStrength = otherPointDefenses + otherPointAdjacentWaterCount + otherPointShipyardBonus; 
            if (strongPointComboStrength < otherPointComboStrength)
            {
                strongPoint = buildablePoints[index];
                strongPointPiece = otherPointPiece;
            }
            else if (strongPointComboStrength === otherPointComboStrength)
            {
                if (strongPointDefenses < otherPointDefenses ||
                    strongPointPiece.boardValue === "p" && otherPointPiece.boardValue === "g")
                {
                    strongPoint = buildablePoints[index];
                    strongPointPiece = otherPointPiece;
                }    
            }
        }
    }
    return buildWingsBeforeTail(thisGame, buildablePoints, strongPoint);
}


function isCenterStrong(thisGame)
{
    const isRedColor = thisGame.perspectiveColor === 0;
    if (isRedColor)
    {
        // Consider enemy path to center.
        const enemyPathToCenterPieceIndices = [28, 37, 45, 46, 47];
        let hasPathCount = 0;    
        for (let index = 0; index < enemyPathToCenterPieceIndices.length; index++)
        {
            const pathPiece = thisGame.pieces[enemyPathToCenterPieceIndices[index]];
            if((pathPiece.boardValue === "p" || pathPiece.boardValue === "g") && hasAdjacentEnemyTown(thisGame, pathPiece))
            {
                hasPathCount++;
                if (hasPathCount > 1)
                {
                    return false;
                }
                // Skip the second path of an edge town if one path is already found to avoid a double-count. 
                if (index === 0 || index === 3)
                {
                    index++;
                }
            }
        }
        // Consider terrain.
        if (thisGame.pieces[30].boardValue !== "m" && thisGame.pieces[30].boardValue !== "f" && 
            (thisGame.pieces[21].boardValue === "m" || thisGame.pieces[31].boardValue === "m" ||
                thisGame.pieces[21].boardValue === "f" && hasAdjacentInlandSea(thisGame, thisGame.pieces[21]) ||
                    thisGame.pieces[31].boardValue === "f" && hasAdjacentInlandSea(thisGame, thisGame.pieces[31])
            ))
        {
            return false;
        }
    }
    return true;
}


function isCenterSupportHexAvailable(thisGame, buildablePoints, index)
{
    return (buildablePoints[index].x === thisGame.pieces[14].boardPoint.x && buildablePoints[index].y === thisGame.pieces[14].boardPoint.y ||
    buildablePoints[index].x === thisGame.pieces[23].boardPoint.x && buildablePoints[index].y === thisGame.pieces[23].boardPoint.y);
}


function isWedgeHexAvailable(thisGame, buildablePoints, index)
{
    return (buildablePoints[index].x === thisGame.pieces[21].boardPoint.x && buildablePoints[index].y === thisGame.pieces[21].boardPoint.y ||
        buildablePoints[index].x === thisGame.pieces[31].boardPoint.x && buildablePoints[index].y === thisGame.pieces[31].boardPoint.y);
}


// Of the original ~5 hexes, build flanks before back-center.
function buildWingsBeforeTail(thisGame, buildablePoints, strongPoint)
{
    if (isSmallBoard)
    {
        const possibleTailIndices = [9, 15, 45, 51];
        const tailIndex = possibleTailIndices.indexOf(thisGame.pieces.findAtPoint(strongPoint).index);
        if (tailIndex > -1)
        {
            const wingIndices = tailIndex === 9 ? [7, 24] : [38, 53];
            let wingPoints = []; 
            for (const wingIndex of wingIndices)
            {
                wingPoints.push(thisGame.boardPointFromValueIndex(wingIndex));
            }
            if (buildablePoints.includes(wingPoints[0]))
            {
                return wingPoints[0];
            }
            if (buildablePoints.includes(wingPoints[1]))
            {
                return wingPoints[1];
            }
        }
    }
    return strongPoint;
}


function findTerrain(thisGame, buildablePoints, terrainValue)
{
    for (const point of buildablePoints)
    {
        const piece = thisGame.pieces.findAtPoint(point);
        if (piece.value === terrainValue)
        {
            return point;
        }
    }
    return null;
}


function getBestReservable(thisGame, movingUnitType, controlsCapital)
{
    // Get reservable points and remove placeholders.
    let reservables = thisGame.pieces.getReservables(thisGame.player.team.color,thisGame.player.team.rulerColor, movingUnitType, controlsCapital);
    for (let i = reservables.length -1; i >= 0; i--)
    {
        if (reservables[i].placeHolderOnly)
		{
			reservables.splice(i, 1);
		}
    }
    // On first turn: try to set infantry in town with adjacent smooth terrain.
    const isFirstTurn = thisGame.maxMoveNumber < 8;
    if (isFirstTurn)
    {
        const reservable = findFirstTurnReservable(thisGame, reservables);
        if (reservable)
        {
            return reservable;
        }
    }
    // Otherwise: prioritize vulnerable towns, followed by towns closest to the enemy.
    sortByClosestToEnemy(thisGame, reservables);
    for (const reservable of reservables)
    {
        const piece = thisGame.pieces.findAtPoint(reservable);
        if (hasThreat(thisGame, piece) && !hasArmy(piece, thisGame.perspectiveColor))
        {
            return reservable;
        }
    }
    return reservables[0];
}


function findFirstTurnReservable(thisGame, reservables)
{
    const topCenterIndex = isSmallBoard ? 51 : thisGame.numberOfDistinctPlayers === 2 ? 79 : null;
    if (topCenterIndex)
    {
        const topCenterPoint =  thisGame.pieces[topCenterIndex].boardPoint;
        let townPoint = null;
        for (const reservable of reservables)
        {
            if (reservable.equals(topCenterPoint) && !thisGame.pieces[topCenterIndex].hasCapital(thisGame.perspectiveColor))
            {
                townPoint = reservable;
                break;
            }
        }
        if (townPoint)
        {
            let adjacentIndecies = thisGame.pieces.findAtPoint(townPoint).getAdjacentIndecies(1);
            for (const index of adjacentIndecies)
            {
                if (hasSmoothTerrain(thisGame, index))
                {
                    return townPoint;       
                }
            }
            const capital = thisGame.pieces.findCapitalPiece(thisGame.perspectiveColor);
            adjacentIndecies = capital.getAdjacentIndecies(1);
            for (const index of adjacentIndecies)
            {
                if (hasSmoothTerrain(thisGame, index))
                {
                    return capital.boardPoint;
                }
            }
        }
    }
    return null;
}


function hasSmoothTerrain(thisGame, pieceIndex)
{
    return (thisGame.pieces[pieceIndex].boardValue === "p" || thisGame.pieces[pieceIndex].boardValue === "g");
}


function sortByClosestToEnemy(thisGame, points)
{
    // Get enemy armies or towns.
    const enemyColors = getEnemyColors(thisGame);
    let enemyArmies = getArmyUnits(thisGame, enemyColors);
    if (!enemyArmies)
    {
        const enemyCivPieces = thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor);
        if (enemyCivPieces.length === 0)
        {
            return;
        }
        const enemyCivPiece = getRandomItem(enemyCivPieces);
        enemyArmies = [enemyCivPiece.findCivilization(enemyCivPiece.getOpponentColor(thisGame.perspectiveColor))];
    }
    let minimumPointToEnemyDistances = []
    // Find the closest distance of each point to all enemies.
    for (const point of points)
    {
        let minDistanceToArmy = Number.MAX_VALUE;
        for (const enemyArmy of enemyArmies)
        {
            const distanceToArmy = thisGame.distanceBewteenPoints(enemyArmy.piece.boardPoint, point);
            if (distanceToArmy < minDistanceToArmy)
            {
                minDistanceToArmy = distanceToArmy;
            }
        }
        minimumPointToEnemyDistances.push(minDistanceToArmy);
    }
    // Sort all reservables based on the closest distance of each to the enemy.
    points.sort(function(a, b){ return minimumPointToEnemyDistances[points.indexOf(a)] - minimumPointToEnemyDistances[points.indexOf(b)] });
}


function fixPiecesPendingValue(thisGame, piecePendingValue)
{
    let logData = new Array();
    let runCount = 0;
    const failsafe = 42;
    while (piecePendingValue && runCount < failsafe) {
        const landHexValue = getRandomAvailableHexValue(thisGame);
        piecePendingValue.setValue(landHexValue);
        thisGame.maybeUndarkPiece(piecePendingValue);
        logData.push(piecePendingValue.index);
        logData.push(landHexValue);
        piecePendingValue = thisGame.pieces.findByBoardValue("l");
        runCount++;
    }
    thisGame.clearMapCustomizationData();
    thisGame.pushMapCustomizationMove(piecePendingValue, logData, logData.length);
    thisGame.update();
}


// Original codebase function modified to get any terrain type, including water.
function getRandomAvailableHexValue(thisGame)
{
    let playOptions=thisGame.playOptions;
    var available=new Array();
    var tileBank=thisGame.resource("tileBank");
    var hexTypes=["p", "g", "f", "m", "w"];
    for (var i=0;i<hexTypes.length;i++)
    {
        var hexType=hexTypes[i];
        var num=tileBank[hexType]-thisGame.pieces.countHexType(hexType);
        for (var j=0;j<playOptions.mapCustomizationData.length;j++)
        if (playOptions.mapCustomizationData.charAt(j)==hexType)
            num--;
        for (var j=0;j<num;j++)
        available.push(hexType);
    }
    if (available.length==0)
        available=hexTypes;
    return available[GamesByEmail.random(available.length-1)];
}


function maybeRecallTroops(thisGame)
{
    if (thisGame.playOptions.redeployment)
    {
        let armyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
        if (armyUnits && armyUnits.length > 0)
        {
            counterGraveDanger(thisGame, armyUnits);
            armyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
            counterThreats(thisGame, armyUnits);
        }
    }
}


function counterGraveDanger(thisGame, armyUnits)
{
    const usingCavalry = false;
    const failsafe = 128;
    let runCount = 0;
    let recallUnits = getPrioritizedRecallUnits(thisGame, armyUnits, usingCavalry);
    for (let unitIndex = 0; unitIndex < recallUnits.length; unitIndex++)
    {
        runCount++;
        const unit = recallUnits[unitIndex];
        if (isLoneCivDefender(thisGame, unit) && hasThreat(thisGame, unit.piece))
        {
            continue;
        }
        const reservables = thisGame.pieces.getReservables(unit.color,unit.rulerColor,unit.type,thisGame.doesColorControlTheirCapital(unit.color));
        if (reservables && reservables.length > 0)
        {
            for (const reservablePoint of reservables)
            {
                const civPiece = thisGame.pieces.findAtPoint(reservablePoint);
                if (hasGraveDanger(thisGame, civPiece))
                {
                    thisGame.reservePhaseOnMouseDown(unit.screenPoint);
                    const targetPiece = thisGame.pieces.findAtPoint(reservablePoint);
                    const targetScreenPoint = targetPiece.$screenRect.getCenter();
                    let success = thisGame.redeployUnitsMouseUp(targetScreenPoint);
                    if (success)
                    {
                        console.log("Troops recalled for civil defense!")
                        break;
                    }
                    else
                    {
                        // Rare case: when units stack on a hex higher than 3 of one type, the higher units cannot be selected first.
                        // Push these units to the end of the unit list and maybe rerun the loop.
                        recallUnits.push(recallUnits.splice(unitIndex, 1)[0]);
                        if (runCount < failsafe)
                        {
                            unitIndex--;
                        }
                        break;
                    }
                }
            }
        }
    }
}


function counterThreats(thisGame, armyUnits)
{
    const usingCavalry = true;
    const failsafe = 256;
    let runCountI = 0;
    let recallUnits = getPrioritizedRecallUnits(thisGame, armyUnits, usingCavalry);
    for (let unitIndex = 0; unitIndex < recallUnits.length && runCountI < failsafe; unitIndex++)
    {
        runCountI++;
        const unit = recallUnits[unitIndex];
        if ((isLoneCivDefender(thisGame, unit) || isSecondCivDefender(thisGame, unit)) && hasThreat(thisGame, unit.piece))
        {
            continue;
        }
        const reservables = thisGame.pieces.getReservables(unit.color,unit.rulerColor,unit.type,thisGame.doesColorControlTheirCapital(unit.color));
        if (reservables && reservables.length > 0)
        {
            let runCountJ = 0;
            for (let index = 0; index < reservables.length && runCountJ < failsafe; index++)
            {
                runCountJ++;
                const reservablePoint = reservables[index];
                const civPiece = thisGame.pieces.findAtPoint(reservablePoint);
                const lastIndex = reservables.length - 1;
                if (civPiece.hasCapital(thisGame.perspectiveColor) && index !== lastIndex)
                {
                    reservables.push(reservables.splice(index, 1)[0]);
                    index--;
                    continue;
                }
                if (isVulnerable(thisGame, civPiece))
                {
                    thisGame.reservePhaseOnMouseDown(unit.screenPoint);
                    const targetPiece = thisGame.pieces.findAtPoint(reservablePoint);
                    const targetScreenPoint = targetPiece.$screenRect.getCenter();
                    const success = thisGame.redeployUnitsMouseUp(targetScreenPoint);
                    if (success)
                    {
                        console.log("Troops recalled for civil defense!")
                        break;
                    }
                    else
                    {
                        // Rare case: when units stack on a hex higher than 3 of one type, the higher units cannot be selected first.
                        // Push these units to the end of the unit list and maybe rerun the loop.
                        recallUnits.push(recallUnits.splice(unitIndex, 1)[0]);
                        if (runCountI < failsafe)
                        {
                            unitIndex--;
                        }
                        break;
                    }
                }
            }
        }
    }
}


function getPrioritizedRecallUnits(thisGame, units, usingCavalry)
{
    // Avoid recall of troops near the enemy, as these may be pinned or holding a seige. 
    orderFromFarthestToEnemy(thisGame, units, true);
    let primaryRecall = [];
    let secondaryRecall = [];
    let tertiaryRecall = [];
    for (let i = units.length-1; i >= 0; i--)
    {
        const unit = units[i];
        const piece = unit.piece;
        // Avoid recall of cavalry, which do best to support other troops and, unlike artillery, have no advantage alone.
        const useCavalry = usingCavalry ? unit.isCavalry() : !unit.isCavalry();
        if (primaryRecall.length === 0)
        {
            // Recall a unit from any large field army.
            if (useCavalry && !piece.hasCivilization(thisGame.perspectiveColor) && piece.countMilitaryUnits(piece.units) > 2)
            {
                primaryRecall = units.splice(i, 1);
                continue;
            }
        }
        if (secondaryRecall.length === 0)
        {
            // Recall a unit from any large civil army.
            if (useCavalry && piece.hasCivilization(thisGame.perspectiveColor) && piece.countMilitaryUnits(piece.units) > 2)
            {
                secondaryRecall = units.splice(i, 1);
                continue;
            }        
        }
        // Recall from troops in the field.
        if (useCavalry && !piece.hasCivilization(thisGame.perspectiveColor))
        {
            tertiaryRecall.push(units.splice(i, 1)[0]);
        }
    }
    return primaryRecall.concat(secondaryRecall).concat(tertiaryRecall).concat(units);
}


function isLoneCivDefender(thisGame, unit)
{
    const civPiece = unit.piece;
    if (civPiece)
    {
        return (civPiece.hasCivilization(thisGame.perspectiveColor) && civPiece.countMilitaryUnits(civPiece.units) === 1);
    }
    return true;
}


function isSecondCivDefender(thisGame, unit)
{
    const civPiece = unit.piece;
    if (civPiece)
    {
        const count = civPiece.countMilitaryUnits(civPiece.units);
        return (civPiece.hasCivilization(thisGame.perspectiveColor) && count === 2);
    }
    return true;
}


function hasThreat(thisGame, piece)
{
    return piece ? (guessThreat(thisGame, piece) > 0) : false;
}


function hasGraveDanger(thisGame, civPiece)
{
    if (civPiece)
    {
        const weightedDangerThreshold = (civPiece.hasTown(thisGame.perspectiveColor) && !civPiece.isMountain()) ? 0 : 3;
        return ((civPiece.countMilitaryUnits(civPiece.units) === 0) && (guessThreat(thisGame, civPiece) > weightedDangerThreshold));
    }
    return false;
}


function maybeRecallFrigatesToPort(thisGame)
{
    if (thisGame.playOptions.redeployment)
    {
        const frigates = findFrigates(thisGame, [thisGame.perspectiveColor]);
        if (frigates.length > 0)
        {
            for (const frigate of frigates)
            {
                const friendlyCiv = findAdjacentFriendlyCiv(thisGame, frigate.piece);
                const civNavalSupportCount = friendlyCiv ? countAdjacentFrigates(thisGame, friendlyCiv) : 0;
                // Skip any frigate with cargo, with a pin, or supporting a friendly.  
                if (frigate.hasUnloadables() || hasAdjacentEnemyTown(thisGame, frigate.piece) || 
                (friendlyCiv && hasThreat(thisGame, friendlyCiv) && civNavalSupportCount <= 1)) 
                {
                    continue;
                }
                else
                {
                    const reservables = thisGame.pieces.getReservables(frigate.color,frigate.rulerColor,frigate.type,thisGame.doesColorControlTheirCapital(frigate.color));
                    if (reservables && reservables.length > 0)
                    {
                        let primaryTargets = [];
                        let secondaryTargets = [];
                        // First consider support for any pinned civilization via a nearby port.
                        const civPieces = thisGame.pieces.getCivilizations(thisGame.perspectiveColor);
                        for (const civPiece of civPieces)
                        {
                            const isPinned = (hasAdjacentEnemyArmy(thisGame, civPiece) || hasAdjacentEnemyFrigate(thisGame, civPiece));
                            if (isPinned && hasAdjacentWater(thisGame, civPiece) && !hasAdjacentFrigate(thisGame, civPiece, thisGame.perspectiveColor))
                            {
                                let adjacentIndecies = civPiece.getAdjacentIndecies(1);
                                for (const pieceIndex of adjacentIndecies)
                                {
                                    const adjacentPiece = thisGame.pieces[pieceIndex];
                                    for (const reservable of reservables)
                                    {
                                        if (adjacentPiece.boardPoint.equals(reservable))
                                        {
                                            primaryTargets.push(reservable);
                                        }
                                    }
                                }
                            } 
                        }
                        // Then check all ports for threats and friendlies.
                        for (let i = 0; i < reservables.length; i++)
                        {
                            // Ports are placeholders, with port-adjacent reservable destinations.
                            if (reservables[i].placeHolderOnly)
                            {
                                const possiblePort = thisGame.pieces.findAtPoint(reservables[i]);
                                const maySupport = hasAdjacentWater(thisGame, possiblePort) && !hasAdjacentFrigate(thisGame, possiblePort, thisGame.perspectiveColor);
                                if (!maySupport)
                                {
                                    continue;
                                }
                                // A port under threat is a primary target.
                                if (hasThreat(thisGame, possiblePort))
                                {
                                    let runCount = 0;
                                    const failsafe = 256;
                                    do 
                                    {
                                        // Push the valid port-adjacent reservables. 
                                        primaryTargets.push(reservables[++i]);
                                        runCount++;
                                    } while ((i+1 < reservables.length) && !reservables[i+1].placeHolderOnly && (runCount < failsafe));
                                    break;
                                }
                                // A port with friendly units is a secondary target.
                                const hasFriendlies = possiblePort.units.length > 2;
                                if (hasFriendlies)
                                {
                                    let runCount = 0;
                                    const failsafe = 256;
                                    do
                                    {
                                        secondaryTargets.push(reservables[++i])
                                        runCount++;
                                    } while ((i+1 < reservables.length) && !reservables[i+1].placeHolderOnly && (runCount < failsafe));
                                }
                            }
                        }
                        const hasTarget = (primaryTargets.length || secondaryTargets.length) > 0;
                        if (hasTarget) 
                        {
                            // Recall the frigate.
                            const targetPoints = primaryTargets.length > 0 ? primaryTargets : secondaryTargets;
                            thisGame.reservePhaseOnMouseDown(frigate.screenPoint);
                            const targetPiece =  thisGame.pieces.findAtPoint(decideBestFrigateRecallPoint(thisGame, targetPoints));
                            const targetScreenPoint = targetPiece.$screenRect.getCenter();
                            thisGame.redeployUnitsMouseUp(targetScreenPoint);
                            console.log("Frigate recalled to port!");   
                        }
                    }
                }
            }
        }
    }
}


function decideBestFrigateRecallPoint(thisGame, targetPoints)
{
    let bestScore = 0;
    let bestTarget = null;
    for (let targetPoint of targetPoints)
    {
        const targetPiece = thisGame.pieces.findAtPoint(targetPoint);
        targetPoint.score = countAdjacentCivilizations(thisGame, targetPiece);
        targetPoint.score += hasAdjacentEnemyTown(thisGame, targetPiece) ? 0.25 : 0;
        targetPoint.score += hasAdjacentEnemyCivilization(thisGame, targetPiece) ? 25 : 0;
        targetPoint.score += hasAdjacentFriendlyArmy(thisGame, targetPiece) ? 0.25 : 0;
        targetPoint.score -= isAccessibleByEnemyFrigate(thisGame, targetPiece) ? 0.5 : 0;
        targetPoint.score -= hasAdjacentEnemyArtillery(thisGame, targetPiece) ? 0.25 : 0;
        if (targetPoint.score > bestScore)
        {
            bestScore = targetPoint.score;
            bestTarget = targetPoint;
        }
    }
    return bestTarget ? bestTarget : getRandomItem(targetPoints);
}


function isAccessibleByEnemyFrigate(thisGame, piece)
{
    let accessible = false;
    const enemyColors = getEnemyColors(thisGame);
    const enemyFrigates = findFrigates(thisGame, enemyColors);
    for (const frigate of enemyFrigates)
    {
        if (isAccessibleNow(piece, frigate))
        {
            accessible = true;
            break;
        }
    }
    return accessible;
}


// Highly specific instructions for the first two turns
function placeCapital(thisGame)
{
    thisGame.maxMoveNumber = thisGame.maxMoveNumber < 4 * thisGame.numberOfDistinctPlayers ? thisGame.maxMoveNumber : 0;
    const isFirstPlayer = thisGame.perspectiveColor === 0;
    const pieceIndexStandardChoices = getCommonInitialChoices(thisGame);
    let pieceIndex = pieceIndexStandardChoices ? isFirstPlayer ? getFirstCapitalPieceIndex(thisGame, [...pieceIndexStandardChoices]) : getNextCapitalPieceIndex(thisGame, [...pieceIndexStandardChoices]) : null;
    let destinationScreenPoint = pieceIndex ? thisGame.pieces[pieceIndex].$screenRect.getCenter() : null;
    // Explore 5 initial hexes, handle water.
    let hexOrder = thisGame.getMapCustomizationData();
    const hasWater = (hexOrder.indexOf("w") > -1) ? true : false;
    if (hasWater)
    {
        let runCount = 0;
        const failsafe = 42;
        while (terrainCount(hexOrder, "w") > 2 && runCount < failsafe)
        {
            thisGame.swapWaterForLand();
            hexOrder = thisGame.getMapCustomizationData();
            runCount++;
        }
    }
    // Decide initial hex order.
    setTimeout(function(){
        thisGame.playOptions.mapCustomizationData = decideInitialHexOrder(hexOrder, pieceIndex, pieceIndexStandardChoices);
        // Decide capital location.
        const shortDelay = 400;
        const longDelay = 700;
        setTimeout(function(){
            thisGame.customizeMapDoAll(true);        
            // Place capital & commit. 
            if (destinationScreenPoint)
            {
                thisGame.placeCapitalMouseDown(destinationScreenPoint);
            }
            let runCount = 0;
            const failsafe = 16;
            while (!commitExploration(thisGame))
            {
                pieceIndex = findStrongTargetPieceIndex(thisGame);
                destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                thisGame.placeCapitalMouseDown(destinationScreenPoint);
                runCount++;
                if (runCount > failsafe)
                {
                    window.isKomputerReady = true;
                    resetKomputerButtonStyle();
                    console.log("Terrain not playable.");
                    return;
                }        
            };
            setTimeout(function(){
                // Maybe swap water hex for land.
                const waterPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_waterSwap");
                if (waterPopup)
                {
                    thisGame.swapWaterForLand();
                    console.log("Water swap!");
                }
                // Maybe reorder hexes explored by capital to keep a fast path to the center.
                const leftSideIndex = pieceIndexStandardChoices ? pieceIndexStandardChoices[0] : pieceIndex;
                if(pieceIndex === leftSideIndex)
                {
                    let hexOrder = thisGame.getMapCustomizationData();
                    thisGame.playOptions.mapCustomizationData = hexOrder.split('').reverse().join('');
                }
                setTimeout(function(){
                    thisGame.customizeMapDoAll(true);
                    // End player 1 turn.
                    if (thisGame.perspectiveColor === 0 && thisGame.numberOfDistinctPlayers < 7)
                    {
                        thisGame.endMyTurn();
                        setTimeout(function()
                        {
                            window.isKomputerReady = true;
                            resetKomputerButtonStyle();
                            console.log("Done.");
                        }, 200);
                    }
                    // Player 2 places another town based on specific location data. Later reserve phases use other guidance.
                    else
                    {
                        if (thisGame.movePhase === 11)
                        {
                            if (thisGame.numberOfDistinctPlayers < 4)
                            {
                                let element = document.querySelector("#Foundation_Elemental_" + gameVersion + "_reserve_0");
                                thisGame.reserveOnMouseDown(null, thisGame.event("reserveOnMouseDown(this,event,#)"), 0);
                                if (pieceIndexStandardChoices && pieceIndexStandardChoices.includes(pieceIndex))
                                {
                                    const centralIndex = pieceIndexStandardChoices[1];
                                    pieceIndex = pieceIndex === centralIndex ? getRandomItem([pieceIndexStandardChoices[0], pieceIndexStandardChoices[2]]) : centralIndex;
                                }
                                else
                                {
                                    pieceIndex = findStrongTargetPieceIndex(thisGame);
                                    if (pieceIndex === null)
                                    {
                                        thisGame.endMyTurn();
                                        window.isKomputerReady = true;
                                        resetKomputerButtonStyle();
                                        console.log("Done.");
                                    }
                                }
                                destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                                thisGame.placeReserveOnMouseUp(destinationScreenPoint);
                                commitExploration(thisGame);
                                setTimeout(function(){
                                    const waterPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_waterSwap");
                                    if (waterPopup)
                                    {
                                        thisGame.swapWaterForLand();
                                        console.log("Water swap!");
                                    }
                                    setTimeout(function(){
                                        thisGame.customizeMapDoAll(true);
                                        element = document.querySelector("#Foundation_Elemental_" + gameVersion + "_reserve_0");
                                        thisGame.reserveOnMouseDown(element, thisGame.event("reserveOnMouseDown(this,event,#)"), 0);
                                        thisGame.placeReserveOnMouseUp( destinationScreenPoint );
                                        thisGame.endMyTurn();
                                        setTimeout(function(){
                                            window.isKomputerReady = true;
                                            resetKomputerButtonStyle();
                                            console.log("Done.");
                                        }, shortDelay)
                                    }, shortDelay)
                                }, longDelay);
                            } // More than 3 players
                            else
                            {
                                placeReserves(thisGame);
                            }
                        }
                    }}, longDelay);
                }, shortDelay);
        }, shortDelay);
    }, 1000)
}


function hasInvalidCapitalHexes(pieceIndexChoices)
{
    if (pieceIndexChoices === null || pieceIndexChoices.length === 0)
    {
        return true;
    }
    return false;
}


function findStrongTargetPieceIndex(thisGame)
{
    if (thisGame.targetPoints && thisGame.targetPoints.length > 0)
    {
        let mountainPieceIndices = [];
        let forestPieceIndices = [];
        let validPieceIndices = [];
        for (const piece of thisGame.pieces)
        {
            if (thisGame.isTargetPoint(piece.boardPoint))
            {
                if (piece.boardValue === "m")
                {
                    mountainPieceIndices.push(piece.index)
                }
                else if (piece.boardValue === "f")
                {
                    forestPieceIndices.push(piece.index)
                }
                else
                {
                    validPieceIndices.push(piece.index);
                }
            }
        }
        return (mountainPieceIndices.length > 0 ? getRandomItem(mountainPieceIndices) : 
                forestPieceIndices.length > 0 ? getRandomItem(forestPieceIndices) : getRandomItem(validPieceIndices));
    }
    return null;
}


function terrainCount(stringHexData, terrainType)
{
      let count = 0;
      for (let i = 0; i < stringHexData.length; i++)
      {
          if (stringHexData.charAt(i) === terrainType)
          {
              count++;
          }
      }
      return count;
}


function getCommonInitialChoices(thisGame)
{
    const choiceCount = thisGame.getNumMapCustomizations();
    let pieceIndexChoices = [];
    let exploredHexIndex = thisGame.boardVisibility.indexOf("1");
    for (let i = 0; i < choiceCount && exploredHexIndex >= 0; i++)
    {
        pieceIndexChoices.push(exploredHexIndex);
        exploredHexIndex = thisGame.boardVisibility.indexOf("1", exploredHexIndex + 1);
    }
    if (pieceIndexChoices.length === 0)
    {
        return null;
    }
    const playerCount = thisGame.numberOfDistinctPlayers;
    if (playerCount > 3 && !playerCount === 6)
    {
        return [Math.min(...pieceIndexChoices)];
    }
    pieceIndexChoices.sort(function(a, b)
    { 
        if (thisGame.pieces[a].$screenRect.x < thisGame.pieces[b].$screenRect.x)
            {
                return -1;
            }
            if (thisGame.pieces[a].$screenRect.x === thisGame.pieces[b].$screenRect.x)
            {
                let mapCenterIndex = Math.floor(thisGame.pieces.length * 0.5) - 1;
                let isOnMapLeftSide = thisGame.pieces[pieceIndexChoices[0]].$screenRect.x < thisGame.pieces[mapCenterIndex].$screenRect.x;
                if (thisGame.pieces[a].$screenRect.y < thisGame.pieces[b].$screenRect.y)
                {
                    if (isOnMapLeftSide)
                    {
                        return 1;
                    }
                    return -1;
                }
            }
        return 1;
    });
    pieceIndexChoices.splice(1, 1);
    pieceIndexChoices.splice(2, 1);    
    return pieceIndexChoices;
}


function getFirstCapitalPieceIndex(thisGame, pieceIndexChoices)
{
    if (hasInvalidCapitalHexes(thisGame, pieceIndexChoices))
    {
        return null;
    }
    const randomMoveChance = 0.03125;  // Yields less than 2% chance of playing center.
    if (Math.random() < randomMoveChance)
    {
        return pieceIndexChoices.splice(getRandomIndexExclusive(pieceIndexChoices.length), 1)[0];
    }
    else
    {
        if (Math.random() < 0.5)
        {
            return pieceIndexChoices.pop();
        }
        else
        {
            return pieceIndexChoices.shift();
        }
    }
}


function getNextCapitalPieceIndex(thisGame, pieceIndexChoices)
{
    if (hasInvalidCapitalHexes(thisGame, pieceIndexChoices))
    {
        return null;
    }
    const firstPlayerColor = 0; 
    const firstPlayerCapitalPiece = thisGame.pieces.findCapitalPiece(firstPlayerColor);
    if (firstPlayerCapitalPiece)
    {
        const centerPieceIndex = Math.floor((thisGame.pieces.length * 0.5) - 1);
        const centerPiece = thisGame.pieces[centerPieceIndex];
        if (firstPlayerCapitalPiece.$screenRect.x < centerPiece.$screenRect.x)
        {
            return pieceIndexChoices.pop();
        }
        else
        {
            return pieceIndexChoices.shift();
        }
    }
    return null;
}


function decideInitialHexOrder(hexOrder, capitalPieceIndex, originalChoices)
{
    // Returns new hex order string, takes hexOrder string and integer index.
    // Ensures land on the first, third, and fifth hex to maximize town growth.
    // Seeks to boost edge town support via land path between center and edge.
    // When capital is on the right, keeps possible water hexes toward the right.
    // Otherwise, keeps water hexes toward the left.
    const rightMostIndex = originalChoices ? originalChoices.length - 1 : null;
    const hasRightSideCapital = rightMostIndex ? capitalPieceIndex === originalChoices[rightMostIndex] : false; 
    const waterCount = terrainCount(hexOrder, "w");
    let newHexOrder = [];
    switch (waterCount)
    {
        case 2: 
            newHexOrder = hasRightSideCapital ? 
                [hexOrder[1], hexOrder[3], hexOrder[0], hexOrder[4], hexOrder[2]] : 
                [hexOrder[2], hexOrder[4], hexOrder[0], hexOrder[3], hexOrder[1]] ;
            break;
        case 1:
            newHexOrder = hasRightSideCapital ? 
                [hexOrder[2], hexOrder[0], hexOrder[1], hexOrder[4], hexOrder[3]] :
                [hexOrder[3], hexOrder[4], hexOrder[1], hexOrder[0], hexOrder[2]] ;
            break;
        default: 
            newHexOrder = hasRightSideCapital ?
                [hexOrder[3], hexOrder[0], hexOrder[2], hexOrder[1], hexOrder[4]] :
                [hexOrder[4], hexOrder[1], hexOrder[2], hexOrder[0], hexOrder[3]] ;
            break;
    }
    // Maybe further improve hex order. 
    const forestCount = terrainCount(hexOrder, "f");
    const grassCount = terrainCount(hexOrder, "g");
    // Try to put a forest in the middle.
    if (forestCount > 0)
    {
        const forestIndex = newHexOrder.indexOf("f");
        const middleIndex = 2;
        swapHexOrder(newHexOrder, forestIndex, middleIndex);
    }
    // Try to put grassland on the far side.
    if (grassCount > 0)
    {
        const grassIndex = newHexOrder.indexOf("g");
        const farSideIndex = hasRightSideCapital ? 0 : 4;
        swapHexOrder(newHexOrder, grassIndex, farSideIndex);
    }
    let hexArray = hexOrder.split("");
    while (newHexOrder.length < hexArray.length)
    {
        newHexOrder.push(hexArray.pop());
    }
    return newHexOrder.join("");
}


function swapHexOrder(initialHexOrder, originIndex, destinationIndex)
{
    if (initialHexOrder[originIndex] !== initialHexOrder[destinationIndex])
    {
        const stash = initialHexOrder[destinationIndex];
        initialHexOrder[destinationIndex] = initialHexOrder[originIndex];
        initialHexOrder[originIndex] = stash;
    }
}


function decideHexOrder(thisGame, hexTerrain, exploringUnitBoardPoint)
{
    let newOrder = [];
    const waterCount = terrainCount(hexTerrain, "w");
    // Find all hex terrain piece indices.
    let hexTerrainPieceIndices = [];
    let hexIndex = thisGame.boardVisibility.indexOf("1");
    if (hexIndex < 0) 
    {
        return hexTerrain;
    }
    hexTerrainPieceIndices.push(hexIndex);
    let runCount = 0;
    const failsafe = 42;
    while (hexTerrainPieceIndices.length < hexTerrain.length && runCount < failsafe) 
    {
        hexIndex = thisGame.boardVisibility.indexOf("1", hexIndex + 1);
        hexTerrainPieceIndices.push(hexIndex);
        runCount++;
    }
    // After the first turn or on any large board, measure how close each hex is to facing the enemy. 
    if (thisGame.maxMoveNumber > 8 || (isLargeBoard && thisGame.perspectiveColor !== 0))
    {
        // For each hex index, find the angle of vectors, from unit to enemy and from unit to hex.
        // Find an enemy point (top / bottom center) and draw a vector to it from the unit origin.
        // Then draw a second vector to the hex and measure the angle.
        const enemyColors = getEnemyColors(thisGame);
        const activeEnemyColors = [];
        for (const color of enemyColors)
        {
            if (thisGame.pieces.getScore(color) > 0)
            {
                activeEnemyColors.push(color);
            }
        }
        const randomEnemyColor = getRandomItem(activeEnemyColors);
        const enemyCapitalPiece = thisGame.pieces.findCapitalPiece(randomEnemyColor);
        const enemyPoint = enemyCapitalPiece.boardPoint.clone();
        const vectorToEnemy = enemyPoint.subtract(exploringUnitBoardPoint);
        const vectorToEnemyWorldAngle = Math.atan2(vectorToEnemy.y, vectorToEnemy.x);
        let angleFromEnemyToHexes = [];
        for (let index = 0; index < hexTerrainPieceIndices.length; index++) {
            const hexPoint = thisGame.pieces[hexTerrainPieceIndices[index]].boardPoint.clone();
            const vectorToHex = hexPoint.subtract(exploringUnitBoardPoint);
            const vectorToHexWorldAngle = Math.atan2(vectorToHex.y, vectorToHex.x);
            const angleFromEnemyToHex = Math.abs(vectorToHexWorldAngle - vectorToEnemyWorldAngle);
            angleFromEnemyToHexes.push(angleFromEnemyToHex);
        }
        // Move water from end of hexTerrain to front, then split into new array.
        // Array hexTerrains has water first, then terrain from fast to slow.
        let hexTerrains = [];
        if (waterCount && waterCount < hexTerrain.length) 
        {
            hexTerrains = (hexTerrain.slice(-waterCount) + hexTerrain.slice(0, -waterCount)).split('');
        }  
        else 
        {
            hexTerrains = hexTerrain.split('');
        }
        // Assign new order, which may be sparse until all elements are assigned.
        let runCount = 0;
        const failsafe = 42;
        while (hexTerrains.length > 0 && runCount < failsafe) {
            // Find the array index of the farthest hex via max angle.
            let maxAngle = Number.MIN_VALUE;
            let maxAngleIndex = null;
            for (let i = 0; i < angleFromEnemyToHexes.length; i++) {
                if (maxAngle < angleFromEnemyToHexes[i]) {
                    maxAngle = angleFromEnemyToHexes[i];
                    maxAngleIndex = i;
                }
            }
            newOrder[maxAngleIndex] = hexTerrains.pop();
            angleFromEnemyToHexes[maxAngleIndex] = Number.MIN_VALUE;
            runCount++;
        }
    }
    else
    {
        newOrder = decideFirstTurnHexOrder(thisGame, hexTerrain, waterCount, hexTerrainPieceIndices);
    }
    return newOrder.join("");
}


function decideFirstTurnHexOrder(thisGame, hexTerrain, waterCount, hexTerrainPieceIndices)
{
    let newOrder = hexTerrain.split('');
    // Keep water from blocking the center.
    if (waterCount) {
        let waterIndex = newOrder.indexOf("w");
        if (
            waterIndex === hexTerrainPieceIndices.indexOf(21) || 
            waterIndex === hexTerrainPieceIndices.indexOf(31) ||
            waterIndex === hexTerrainPieceIndices.indexOf(22)) 
        {
            if (waterCount === 1)
            {
                if (waterIndex === hexTerrainPieceIndices.indexOf(22))
                {
                    swapHexOrder(newOrder, waterIndex, 0);
                }
                else
                {
                    newOrder.unshift(newOrder.pop());
                }
            }
            else
            {
                newOrder.reverse();
            }
        }
        // Keep water from blocking the capital "outpost" town, 2 hexes away on the perimeter.
        const capitalPiece = thisGame.pieces.findCapitalPiece(thisGame.perspectiveColor);
        let outPost = null;
        switch(capitalPiece.index)
        {
            case 7:
                outPost = 12;
                break;
            case 24:
                outPost = 41;
                break;
            case 36:
                outPost = 19;
                break;
            case 53:
                outPost = 48;
                break;
        }
        if (outPost && hexTerrainPieceIndices.includes(outPost))
        {
            waterIndex = newOrder.indexOf("w");
            if (waterIndex === hexTerrainPieceIndices.indexOf(outPost))
            {
                let terrainIndex = 0;
                for (const terrain of newOrder)
                {
                    if (terrain !== "w")
                    {
                        break;
                    }
                    terrainIndex++;
                }
                swapHexOrder(newOrder, waterIndex, terrainIndex);
            }
        }
    }
    // No water: maybe reorder land hexes to keep hard terrain forward.
    else
    {
        if (hexTerrainPieceIndices.includes(21))
        {
            swapHexOrder(newOrder, 1, hexTerrainPieceIndices.length-1);
        }
    }
    return newOrder;
}


function hasAdjacentFriendlyCiv(thisGame, piece)
{
      let adjacentPiece;
      return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
}


function findAdjacentFriendlyCiv(thisGame, piece)
{
      let adjacentPiece;
      return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ? adjacentPiece : null;
}


function findAdjacentFriendlyArmy(thisGame, piece)
{
    let color = thisGame.perspectiveColor;
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, color)) ? adjacentPiece : null;
}


function countAdjacentCivilizations(thisGame, piece)
{
    let count = 0;
    let adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y);
    let hasCiv = (adjacentPiece && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
    if (hasCiv)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y);
    hasCiv = (adjacentPiece && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
    if (hasCiv)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1);
    hasCiv = (adjacentPiece && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
    if (hasCiv)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1);
    hasCiv = (adjacentPiece && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
    if (hasCiv)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1);
    hasCiv = (adjacentPiece && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
    if (hasCiv)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1);
    hasCiv = (adjacentPiece && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
    if (hasCiv)
    {   
        count++;
    }
    return count;
}


function countAdjacentFrigates(thisGame, piece)
{
    let count = 0;
    let adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y);
    let hasFrigate = (adjacentPiece && adjacentPiece.hasFrigate(thisGame.perspectiveColor));
    if (hasFrigate)
    {
        count += countUnit(adjacentPiece, "f");
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y);
    hasFrigate = (adjacentPiece && adjacentPiece.hasFrigate(thisGame.perspectiveColor));
    if (hasFrigate)
    {
        count += countUnit(adjacentPiece, "f");
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1);
    hasFrigate = (adjacentPiece && adjacentPiece.hasFrigate(thisGame.perspectiveColor));
    if (hasFrigate)
    {
        count += countUnit(adjacentPiece, "f");
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1);
    hasFrigate = (adjacentPiece && adjacentPiece.hasFrigate(thisGame.perspectiveColor));
    if (hasFrigate)
    {
        count += countUnit(adjacentPiece, "f");
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1);
    hasFrigate = (adjacentPiece && adjacentPiece.hasFrigate(thisGame.perspectiveColor));
    if (hasFrigate)
    {
        count += countUnit(adjacentPiece, "f");
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1);
    hasFrigate = (adjacentPiece && adjacentPiece.hasFrigate(thisGame.perspectiveColor));
    if (hasFrigate)
    {   
        count += countUnit(adjacentPiece, "f");
    }
    return count;
}


function countUnit(piece, type, color)
{
    let count = 0;
    for (const unit of piece.units)
    {
        if (unit.type === type)
        {
            count++;
        }
    }
    return count;
}


function hasAdjacentEnemyCivilization(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor));
}


function hasAdjacentEnemyTown(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor));
}


function hasAdjacentHiddenTerrain(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hidden);
}


function hasAdjacentWater(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden);
}


function hasAdjacentDeepWater(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.isPerimeter()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.isPerimeter()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.isPerimeter()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.isPerimeter()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.isPerimeter()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.isPerimeter());
}


function hasAdjacentInlandSea(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
}


function countAdjacentInlandSea(thisGame, piece)
{
    let count = 0;
    let adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y);
    let hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
    if (hasSea)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y);
    hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
    if (hasSea)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1);
    hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
    if (hasSea)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1);
    hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
    if (hasSea)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1);
    hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
    if (hasSea)
    {
        count++;
    }
    adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1);
    hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
    if (hasSea)
    {   
        count++;
    }
    return count;
}


function isAccessibleNow(piece, unit, viaCargo = false)
{
    if (piece && unit)
    {
        let unitMovablePoints = [];
        if (unit.isFrigate() && viaCargo)
        {
            const hasCargo = unit.cargo.length > 0;
            maybeAddImaginaryCargo(unit, hasCargo);
            unitMovablePoints = getFrigateMovables(unit);
            removeImaginaryCargo(unit);
        }
        else
        {
            unitMovablePoints = unit.getMovables();
        }
        if (unitMovablePoints && unitMovablePoints.length)
        {
            for (const point of unitMovablePoints)
            {
                if (point.x === piece.boardPoint.x && point.y === piece.boardPoint.y)
                {
                    return true;
                }
            }
        }
    }
    return false;
}


function hasAdjacentBattle(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor));
}


function findAdjacentBattle(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor)) ? adjacentPiece : null;
}


function hasAdjacentFrigate(thisGame, piece, color)
{
    if (typeof(color) === "undefined")
    {
        color = thisGame.perspectiveColor;
    }
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasFrigate(color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasFrigate(color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasFrigate(color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasFrigate(color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasFrigate(color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasFrigate(color));
}


function hasAdjacentEnemyFrigate(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f"));
}


function hasAdjacentEnemyArtillery(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a")) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a"));
}


function hasAdjacentEnemyArmy(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && hasEnemyArmy(thisGame, adjacentPiece)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && hasEnemyArmy(thisGame, adjacentPiece)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && hasEnemyArmy(thisGame, adjacentPiece)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && hasEnemyArmy(thisGame, adjacentPiece)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && hasEnemyArmy(thisGame, adjacentPiece)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && hasEnemyArmy(thisGame, adjacentPiece));
}


function hasAdjacentFriendlyArmy(thisGame, piece)
{
    const color = thisGame.perspectiveColor;
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, color)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, color));
}


function hasArmy(piece, color)
{
    return (piece.hasInfantry(color) || piece.hasArtillery(color) || piece.hasCavalry(color));
}


function hasEnemyArmy(thisGame, piece)
{
    return (piece.countOpponentMilitary(thisGame.perspectiveColor) > 0 && !piece.hasOpponentUnit(thisGame.perspectiveColor, "f"));
}


function getArmyUnits(thisGame, colors)
{
    let armies = [];
    for (const piece of thisGame.pieces)
    {
        const reserveIndex = -1;
        if (piece.isWater() || piece.valueIndex === reserveIndex)
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (colors.includes(unit.color) && unit.isMilitary())
            {
                armies.push(unit);
            }
        }
    }
    return (armies.length > 0 ? armies : null );
}


function getRandomItem(items)
{
    if (!items || !items.length)
    {
        return null;
    }
    const MAX = items.length;
    const RANDOM_INDEX = getRandomIndexExclusive(MAX);
    return items[RANDOM_INDEX];
}


function getRandomIndexExclusive(max)
{
    return Math.floor(Math.random() * max);
}


function shuffle(string)
{
    // Schwartzian Transform, from anonymous on Stackoverflow - see Wikipedia for description.
    return string.split("").map(v => [v, Math.random()]).sort((a, b) => a[1] - b[1]).map(v => v[0]).join("");
}


// Clone for an original codebase function with a few mods to support automated play.
function moveUnitSimulateMouseDown(thisGame, screenPoint, type)
{
    thisGame.maybeResetReservesByMouseUp();
    thisGame.moveBombardUnitsMouseOut(screenPoint=thisGame.constrainPoint(screenPoint));
    thisGame.maybeHideOverlay();
    let unit=thisGame.militaryUnitFromScreenPoint(screenPoint,type,thisGame.player.team.color,thisGame.player.team.rulerColor,true);
    if (unit)
    {
        if (unit.isFrigate())
        {
            thisGame.setTargetPoints(getFrigateMovables(unit));
        }
        else
        {
            thisGame.setTargetPoints(unit.getMovables());
        }
        thisGame.onLeftMouseUp="moveUnitsMouseUp";
        thisGame.onMouseMove=null;
        thisGame.onMouseOver=null;
        thisGame.onMouseOut=null;
        let piece=thisGame.pieces.getNewPiece();
        piece.setMovingUnit(unit);
        return true;
    }
    else
    {
        let boardPoint;
        let piece;
        if ((boardPoint=thisGame.boardPointFromScreenPoint(screenPoint)) &&
            (piece=thisGame.pieces.findAtPoint(boardPoint)) &&
            piece.hasBattle(thisGame.player.team.color,thisGame.player.team.rulerColor))
        {
            piece.setBorder(true);
            thisGame.battleIndex=piece.index;
            thisGame.pushMove("Battle",thisGame.logEntry(6,piece.index,piece.boardValue,piece.getOpponentColor(thisGame.player.team.color)),piece,piece.hasPreBattle(thisGame.player.team.color) ? "processPreBattleMove" : "processStartBattleMove",true,"beginBattle","cancel");
            thisGame.update();
        }
        else
        {
            thisGame.showOverlay();
        }
        return false;
    }
}


// Custom getMovables for frigates includes long-range unload movables. 
function getFrigateMovables(unit)
{
    var movables=new Array();
    var allowance=unit.movementAllowance-unit.spacesMoved;
    unit.piece.pieces.setRecursionFlag("bestAllowance",-1);
    if (!unit.movementComplete)
        unit.addFrigateMovables(movables, unit.piece.boardPoint.x, unit.piece.boardPoint.y, allowance, 0, false, -1);
    if (unit.hasUnloadables())
    {
        for (let i=movables.length-1; i >= 0; i--)
        {
            addFrigateUnloadMoveable(unit, movables, movables[i].x-1, movables[i].y, movables[i].index, movables[i].spacesNeeded);
            addFrigateUnloadMoveable(unit, movables, movables[i].x+1, movables[i].y, movables[i].index, movables[i].spacesNeeded);
            addFrigateUnloadMoveable(unit, movables, movables[i].x, movables[i].y-1, movables[i].index, movables[i].spacesNeeded);
            addFrigateUnloadMoveable(unit, movables, movables[i].x, movables[i].y+1, movables[i].index, movables[i].spacesNeeded);
            addFrigateUnloadMoveable(unit, movables, movables[i].x-1, movables[i].y-1, movables[i].index, movables[i].spacesNeeded);
            addFrigateUnloadMoveable(unit, movables, movables[i].x+1, movables[i].y+1, movables[i].index, movables[i].spacesNeeded);
        }
        unit.addUnloadMoveables(movables);
    }
    return movables.length>0 ? movables : null;
}


function addFrigateUnloadMoveable(unit, movables, x, y, retreatIndex, spacesNeeded)
{
    var piece=unit.piece.pieces.findAtXY(x,y);
    if (piece && piece.isLand())
    {
        piece.pushMoveable(movables,unit.color,unit.rulerColor,spacesNeeded,retreatIndex);    
    }
}


// Clone for an original codebase function with mods on frigate unloading.
function moveUnitSimulateMouseUp(thisGame, screenPoint)
{
    thisGame.onMouseMove=null;
    thisGame.onLeftMouseUp=null;
    if (thisGame.lastLoadableUnit)
    {
        thisGame.lastLoadableUnit.setHilite(false);
        thisGame.lastLoadableUnit=null;
    }
    let movingPiece=thisGame.pieces.getNewPiece();
    let boardPoint=thisGame.boardPointFromScreenPoint(screenPoint);
    if (thisGame.isTargetPoint(boardPoint))
    {
        let targetPiece=thisGame.pieces.findAtPoint(boardPoint);
        // Load frigate
        if (movingPiece.movingUnit.isLandUnit() &&
            targetPiece.isWater())
        {
        let oldPiece=movingPiece.movingUnit.piece;
        let loadableUnit=thisGame.militaryUnitFromScreenPoint(screenPoint,null,movingPiece.movingUnit.color,movingPiece.movingUnit.rulerColor,false,false,true);
        let log=thisGame.logEntry(7,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.type,loadableUnit.type);
        loadableUnit.loadCargo(movingPiece.movingUnit);
        movingPiece.setMovingUnit(null);
        oldPiece.updateUnitDisplay();
        loadableUnit.piece.updateUnitDisplay();
        thisGame.setTargetPoints(null);
        let nltd=thisGame.nothingLeftToDo();
        thisGame.pushMove("Load",log,targetPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
        }
        // Unload frigate.
        else if (movingPiece.movingUnit.isFrigate() &&
            targetPiece.isLand())
        {
            let oldPiece=movingPiece.movingUnit.piece;
            // For unload on long-range target, move frigate to appropriate origin.
            if (!isAdjacent(thisGame, oldPiece.boardPoint, targetPiece.boardPoint)) 
            {
                const invasionOrigin = findBestAmphibiousInvasionOrigin(thisGame, targetPiece);
                const originTargetPoint = thisGame.targetPoints[thisGame.findTargetPoint(invasionOrigin.boardPoint)]; 
                movingPiece.movingUnit.moveTo(invasionOrigin, originTargetPoint.spacesNeeded, originTargetPoint.retreatIndex);
                oldPiece.updateUnitDisplay();
                invasionOrigin.updateUnitDisplay();
                // Check for blocking frigate at invasion origin before unload.
                if (invasionOrigin.hasRollingOpponent(thisGame.perspectiveColor))
                {
                    clearIntervalsAndTimers();
                    clearMovementFlags();
                    let log=thisGame.logEntry(8,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.getActiveCargoType(),movingPiece.movingUnit.type);
                    movingPiece.movingUnit.piece.updateUnitDisplay();
                    movingPiece.setMovingUnit(null);
                    targetPiece.updateUnitDisplay();
                    thisGame.setTargetPoints(null);
                    thisGame.update();
                    setTimeout(function(){ fightBattle(thisGame, invasionOrigin); }, 1000)
                    return;
                }
            }
            // Select and unload the last cargo.
            movingPiece.movingUnit.activeCargoIndex = (movingPiece.movingUnit.cargo.length - 1);
            let log=thisGame.logEntry(8,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.getActiveCargoType(),movingPiece.movingUnit.type);
            movingPiece.movingUnit.unloadCargo(targetPiece);
            movingPiece.movingUnit.piece.updateUnitDisplay();
            movingPiece.setMovingUnit(null);
            targetPiece.updateUnitDisplay();
            thisGame.setTargetPoints(null);
            let nltd=thisGame.nothingLeftToDo();
            thisGame.pushMove("Unload",log,targetPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
        }
        else
        {
            let oldPiece=movingPiece.movingUnit.piece;
            let tp=thisGame.getTargetPoint(boardPoint);
            let log=thisGame.logEntry(9,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.type,tp.spacesNeeded);
            movingPiece.movingUnit.moveTo(targetPiece,tp.spacesNeeded,tp.retreatIndex);
            movingPiece.setMovingUnit(null);
            oldPiece.updateUnitDisplay();
            targetPiece.updateUnitDisplay();
            thisGame.setTargetPoints(null);
            let nltd=thisGame.nothingLeftToDo();
            thisGame.pushMove("Move",log,targetPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
        }
    }
    else
    {
        thisGame.setTargetPoints(null);
        thisGame.onLeftMouseUp=null;
        thisGame.onMouseMove=null; 
        thisGame.onMouseOver=null;  
        thisGame.onMouseOut=null;  
        if (movingPiece.movingUnit)
        {
            movingPiece.movingUnit.setVisibility(true);
            let piece=movingPiece.movingUnit.piece;
            movingPiece.setMovingUnit(null);
            if (piece.boardPoint.equals(boardPoint) &&
                piece.hasBattle(thisGame.player.team.color,thisGame.player.team.rulerColor))
            {
                piece.setBorder(true);
                thisGame.battleIndex=piece.index;
                thisGame.pushMove("Battle",thisGame.logEntry(6,piece.index,piece.boardValue,piece.getOpponentColor(thisGame.player.team.color)),piece,piece.hasPreBattle(thisGame.player.team.color) ? "processPreBattleMove" : "processStartBattleMove",true,"beginBattle","cancel");
            }
        }
    }
    thisGame.update();
}


function isAdjacent(thisGame, point1, point2)
{
    return (thisGame.distanceBewteenPoints(point1, point2) === 1);
}


function isAmphibiousCapable(thisGame, piece, color)
{
   return thisGame.isTargetPoint(piece.boardPoint) && piece.isWater() && !piece.hasOpponentPennant(color);
}


function findBestAmphibiousInvasionOrigin(thisGame, landPiece)
{
    let bestOrigin = null;
    let possibleOrigins = [];
    const color = thisGame.perspectiveColor;
    const adjacentPieceIndices = landPiece.getAdjacentIndecies(1);
    for (const pieceIndex of adjacentPieceIndices)
    {
        const piece = thisGame.pieces[pieceIndex];
        if (isAmphibiousCapable(thisGame, piece, color))
        {
            possibleOrigins.push(piece);
        }
    }
    for (const origin of possibleOrigins)
    {
        if (!origin.hasOpponentUnit(thisGame.perspectiveColor, "f"))
        {
            bestOrigin = origin;
            break;
        }
    }
    return bestOrigin ? bestOrigin : getRandomItem(possibleOrigins);
}


// Clone for an original codebase function with a few mods to support automated play.
function bombardUnitsSimulateMouseDown(thisGame, bombardingUnit = null)
{
    thisGame.maybeResetReservesByMouseUp();
    thisGame.maybeHideOverlay();
    thisGame.bombardingUnit = bombardingUnit;
    if (bombardingUnit)
    {
        let screenPoint = bombardingUnit.screenPoint;
        thisGame.moveBombardUnitsMouseOut(screenPoint = thisGame.constrainPoint(screenPoint));
        thisGame.setTargetPoints(bombardingUnit.getBombardables());
        thisGame.onMouseMove="bombardUnitsMouseMove";
        thisGame.onRightMouseUp="bombardUnitsMouseUp";
        thisGame.onMouseOver=null;
        thisGame.onMouseOut=null;
        let movingPiece = thisGame.pieces.getNewPiece();
        movingPiece.setMovingUnit(new GamesByEmail.Viktory2Unit(null,-1,thisGame.player.team.color,"b"));
        bombardingUnit.setHilite(true);
        movingPiece.center(screenPoint.subtract(2,5));
    }
    else
    {
        thisGame.showOverlay();
    }
}


// Clone for an original codebase function with a few mods to support automated play.
function bombardUnitsSimulateMouseUp(thisGame, screenPoint)
{
    thisGame.onMouseMove = null;
    thisGame.onLeftMouseUp = null;
    let movingPiece = thisGame.pieces.getNewPiece();
    let boardPoint = thisGame.boardPointFromScreenPoint(screenPoint);
    if (thisGame.isTargetPoint(boardPoint))
    {
        movingPiece.snap(boardPoint);
        let targetPiece = thisGame.pieces.findAtPoint(boardPoint);
        thisGame.pushMove("Bombard",thisGame.logEntry(11,thisGame.bombardingUnit.piece.index,thisGame.bombardingUnit.piece.boardValue,targetPiece.index,targetPiece.boardValue,thisGame.bombardingUnit.type,targetPiece.findOpponentMilitary(thisGame.player.team.color).color,targetPiece.countOpponentMilitary(thisGame.player.team.color)),targetPiece,"processBombardUnitMove",true,"beginBombard","cancel");
        thisGame.update();
        return true;
    }
    return false;
}


// Patch adds a check for null before accessing each element. 
// Overwrites original codebase function.
function patchUnitPrototype()
{
    GamesByEmail.Viktory2Unit.prototype.setHilite = function (hiliteOn) 
    {
        var zIndex = this.zIndex;
        if (hiliteOn)
            zIndex += 40;
        var e = this.getElement();
        if (e) {
            GamesByEmail.positionImage(e, this.screenPoint, this.getClipRect(hiliteOn));
            e.style.zIndex = zIndex++;
            if (this.cargo.length > 0) {
                var sp = this.screenPoint.clone().add(GamesByEmail.Viktory2Unit.CARGO_OFFSET);
                for (var i = 0; i < this.cargo.length; i++) {
                    e = this.getElement(i);
                    if (e) {
                        GamesByEmail.positionImage(e, sp, this.getCargoClip(this.cargo.charAt(i), hiliteOn && i != this.activeCargoIndex));
                        e.style.zIndex = zIndex++;
                        sp.add(GamesByEmail.Viktory2Unit.CARGO_STAGGER);
                    }
                }
            }
        }
    }
}


// Patch adds a check for array before accessing. 
// Overwrites original codebase function.
function patchPiecePrototype()
{
    GamesByEmail.Viktory2Piece.prototype.getRetreatables = function(color)
    {
        if (this.retreatIndices)
        {
            return this.isLand() ? this.getLandRetreatables(color) : this.getWaterRetreatables(color);
        }
        return new Array();
    }
}


// Patch shows or hides Komputer controls depending on the active tab.
// Overwrites original codebase functions.
function patchControls()
{
    GamesByEmail.Controls.StartGameStartTab.prototype.bringToFront = function(event, bringTitleIntoView)
    {
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        const startNewGameTabId = "Foundation_Elemental_1_title_0";
        if (event.target.id === startNewGameTabId)
        {
            hideKomputerControls();
        }
    }

    GamesByEmail.Controls.StartGameJoinTab.prototype.bringToFront = function(event, bringTitleIntoView)
    {
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        const joinGameTabId = "Foundation_Elemental_1_title_1"; 
        if (event.target.id === joinGameTabId)
        {
            hideKomputerControls();
        }
    }

    GamesByEmail.Controls.StartGamePreviewTab.prototype.bringToFront = function(event, bringTitleIntoView)
    {
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        const seePreviewTabId = "Foundation_Elemental_1_title_2";
        if (event.target.id === seePreviewTabId)
        {
            setTimeout(function(){ showKomputerControls() }, 200);
        }
    }
}


function hideKomputerControls()
{
    const visible = false;
    resetAllButtonStyles(visible);
}


function showKomputerControls()
{
    resetAllButtonStyles();
}


// Patch adds check for objects before accessing.
// Overwrites original codebase function.
function patchGamePrototype()
{
    GamesByEmail.Viktory2Game.prototype.redeployUnitsMouseUp = function(screenPoint)
    {
        this.onMouseMove=null;
        this.onLeftMouseUp=null;
        var boardPoint=this.boardPointFromScreenPoint(this.constrainPoint(screenPoint));
        var movingPiece=this.pieces.getNewPiece();
        if (!boardPoint || !movingPiece || !movingPiece.movingUnit)
        {
            return false;
        }
        var movingUnit=movingPiece.movingUnit;
        var oldPiece=movingPiece.movingUnit.piece;
        if (this.isTargetPoint(boardPoint) && !boardPoint.equals(oldPiece.boardPoint))
        {
           this.readyToSend=false;
           var log;
           var target=this.pieces.findAtPoint(boardPoint);
           if (movingUnit.isFrigate())
           {
              var civ=this.pieces.findAtPoint(this.getTargetPlaceHolderPoint(boardPoint)).findCivilization(movingUnit.color);
              civ.tookReserveUnit(movingUnit.type);
              log=this.logEntry(22,civ.piece.index,civ.piece.boardValue,civ.color,civ.type,movingUnit.type,target.index,target.boardValue);
              if (movingUnit.cargo.length>0)
              {
                 this.player.team.reserveUnits+=movingUnit.cargo;
                 log=this.logEntry(26,oldPiece.index,oldPiece.boardValue,movingUnit.color,movingUnit.cargo)+log;
              }
           }
           else
           {
              var civ=target.findCivilization(movingUnit.color);
              civ.tookReserveUnit(movingUnit.type);
              log=this.logEntry(21,civ.piece.index,civ.piece.boardValue,civ.color,civ.type,movingUnit.type);
           }
           log=this.logEntry(25,oldPiece.index,oldPiece.boardValue,movingUnit.color,movingUnit.type)+log;
           target.addUnit(movingUnit.color,movingUnit.type).movementComplete=true;
           movingUnit.remove(true);
           target.updateUnitDisplay();
           this.setTargetPoints(null);
           movingPiece.setMovingUnit(null);         
           
           this.pushMove("Redeploy and Place Reserve",log,target);
           this.update();
        }
        else
        {
           this.setTargetPoints(null);
           if (screenPoint.y>this.board.image.size.y+14)
           {
              this.readyToSend=false;
              var log=this.logEntry(25,oldPiece.index,oldPiece.boardValue,movingUnit.color,movingUnit.type)+log;
              if (movingUnit.isFrigate() &&
                  movingUnit.cargo.length>0)
                 log+=this.logEntry(26,oldPiece.index,oldPiece.boardValue,movingUnit.color,movingUnit.cargo);
              movingUnit.remove(true);
              movingPiece.setMovingUnit(null);
              var nltd=this.nothingLeftToDo();
              this.pushMove("Redeploy",log,oldPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
              this.update();
           }
           else
           {
              var civ=oldPiece.findCivilization(movingUnit.color);
              if (civ)
                 civ.tookReserveUnit(movingUnit.type);
              movingUnit.setVisibility(true);
              movingPiece.setMovingUnit(null);
           }
        }
        return true;
    }
}


function styleGameMessageBox(thisGame)
{
    if (!thisGame.previewing)
    {
        let messageReadBox = document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageRead");
        let messageWriteBox = document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageWrite");
        messageReadBox.style.height = 164;
        messageWriteBox.style.height = 72
    }
}


function addRunButton(text, onclick, pointerToGame) {
    let style = {position: 'absolute', top: getRunButtonTop(), left:'24px', 'z-index': '9999', "-webkit-transition-duration": "0.6s", "transition-duration": "0.6s", overflow: 'hidden', width: '128px', 'font-size': '10px'}
    let button = document.createElement('button'), btnStyle = button.style
    document.body.appendChild(button) // For now, this works well enough.
    button.setAttribute("class", "button_runKomputer");
    button.innerText = text;
    button.id = "KomputerButton";
    button.onclick = function() {onclick(pointerToGame)};
    Object.keys(style).forEach(key => btnStyle[key] = style[key])

    // Add Button Press Transition 1
    const cssButtonClassString1 = ".button_runKomputer:after{content: ''; background: #90EE90; display: block; position: absolute; padding-top: 300%; padding-left: 350%; margin-left: -20px!important; margin-top: -120%; opacity: 0; transition: all 1.0s}";
    const styleTag1 = document.createElement("style");
    styleTag1.innerText = cssButtonClassString1;
    document.head.insertAdjacentElement('beforeend', styleTag1);

    // Add Button Press Transition 2
    const cssButtonClassString2 = ".button_runKomputer:active:after{padding: 0; margin: 0; opacity: 1; transition: 0s}";
    const styleTag2 = document.createElement("style");
    styleTag2.innerText = cssButtonClassString2;
    document.head.insertAdjacentElement('beforeend', styleTag2);
}


function addStopButton(text, onclick)
{
    let style = {position: 'absolute', top: getStopButtonTop(), left:'56px', 'z-index': '9999', "-webkit-transition-duration": "0.2s", "transition-duration": "0.2s", overflow: 'hidden', width: '64px', 'font-size': '10px'}
    let button = document.createElement('button'), btnStyle = button.style
    document.body.appendChild(button) // For now, this works well enough.
    button.setAttribute("class", "button_stopKomputer");
    button.id = "StopKomputerButton";
    button.innerText = text;
    button.onclick = function() {onclick()};
    Object.keys(style).forEach(key => btnStyle[key] = style[key])

    // Add Button Press Transition 1
    const cssButtonClassString1 = ".button_stopKomputer:after{content: ''; background: #FF6347; display: block; position: absolute; padding-top: 300%; padding-left: 350%; margin-left: -20px!important; margin-top: -120%; opacity: 0; transition: all 0.4s}";
    const styleTag1 = document.createElement("style");
    styleTag1.innerText = cssButtonClassString1;
    document.head.insertAdjacentElement('beforeend', styleTag1);

    // Add Button Press Transition 2
    const cssButtonClassString2 = ".button_stopKomputer:active:after{padding: 0; margin: 0; opacity: 1; transition: 0s}";
    const styleTag2 = document.createElement("style");
    styleTag2.innerText = cssButtonClassString2;
    document.head.insertAdjacentElement('beforeend', styleTag2);
}


function addDarkModeToggle()
{
    let toggle = document.createElement("input");
    toggle.setAttribute("type", "checkbox");
    toggle.id = "DarkModeToggle";
    toggle.addEventListener('click', function(){
        console.log("Dark Mode: " + this.checked);
        maybeStylePage(this.checked);
    });
	let style = {position: 'absolute', top: getDarkModeToggleTop(), left:'128px', 'z-index': '9999'};
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    document.body.appendChild(toggle);
    // Toggle Label
    let toggleLabel = document.createElement("label");
    toggleLabel.id = "DarkModeLabel";
    toggleLabel.htmlFor = "DarkModeToggle";
    toggleLabel.innerText = "Dark";
    style = {position: 'absolute', top: getDarkModeToggleLabelTop(), left:'147px', 'z-index': '9999', 'font-size': '8px'};
    Object.keys(style).forEach(key => toggleLabel.style[key] = style[key]);
    document.body.appendChild(toggleLabel);
}


function getRunButtonTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + gameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 'px');
}

function getStopButtonTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + gameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 20 + 'px');
}


function getDarkModeToggleTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + gameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 18 + 'px');
}


function getDarkModeToggleLabelTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + gameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 22 + 'px');
}


function stopKomputerClick()
{
    window.stopKomputer = true;
    styleButtonForStop();
    setTimeout(function(){
        if (window.stopKomputer === true)
        {
            window.stopKomputer = false;
            resetStopKomputerButtonStyle();
            throw new Error(getErrorMessage());
        }
    }, 3000);
}


function getErrorMessage()
{
    return "Force Stop. Possibly no error. Error thrown in case of undetected infinite loop. \
The Stop Button was pressed when it appears the Komputer was not running. \
If so, please ignore this message. If the game was hung, I apologize - feel free to send the error here: \n\
stephen.montague.viktory@gmail.com"
}


function stopAndReset(resetKomputerButton = true)
{
    clearIntervalsAndTimers();
    resetAllButtonStyles();
    resetGlobals(resetKomputerButton);
    console.log("Manually Stopped.");
}


function resetAllButtonStyles(visible = true)
{
    resetKomputerButtonStyle();
    resetStopKomputerButtonStyle();
    resetButtonPositions(visible);
    showEndTurnButtons();
}


function styleButtonForStop()
{
    let button = document.getElementById("StopKomputerButton");
    button.style.backgroundColor = 'lightpink';
    button.style.color = 'crimson';
    button.innerText = "Stopping";
    resetButtonPositions();
}


function styleButtonForRun()
{
    let button = document.getElementById("KomputerButton");
    button.style.backgroundColor = 'mediumseagreen';
    button.style.color = 'crimson';
    button.innerText = "Running";
    resetButtonPositions();
}


function resetKomputerButtonStyle(isGameWon = false, message = "Let Komputer Play")
{
    let button = document.getElementById("KomputerButton");
    button.style.backgroundColor = '';
    button.style.color = '';
    button.innerText = isGameWon ? "Viktory" : message;
    resetButtonPositions();
}


function resetStopKomputerButtonStyle()
{
    let button = document.getElementById("StopKomputerButton");
    button.style.backgroundColor = '';
    button.style.color = '';
    button.innerText = "Stop";
    resetButtonPositions();
}


function resetButtonPositions(visible = true)
{
    let runButton = document.getElementById("KomputerButton");
    let stopButton = document.getElementById("StopKomputerButton");
    let darkModeToggle = document.getElementById("DarkModeToggle");
    let darkModeLabel = document.getElementById("DarkModeLabel");
    let boardBuilder = document.getElementById("BoardBuilder");
    let boardBuilderToggle = document.getElementById("BoardBuilderToggle");
    let multiplayerForm = document.getElementById("MultiplayerForm");
    if (visible)
    {
        runButton.style.top = getRunButtonTop();
        stopButton.style.top = getStopButtonTop();
        darkModeToggle.style.top = getDarkModeToggleTop();
        darkModeLabel.style.top = getDarkModeToggleLabelTop();
        runButton.style.visibility = ""; 
        stopButton.style.visibility = "";
        darkModeToggle.style.visibility = ""; 
        darkModeLabel.style.visibility = ""; 
        if (boardBuilder && boardBuilderToggle)
        {
            boardBuilder.style.top = getBoardBuilderTop();
            boardBuilder.style.left = getBoardBuilderLeft();
            boardBuilderToggle.style.top = getBoardBuilderToggleTop();
            boardBuilderToggle.style.left = getBoardBuilderToggleLeft();
            if (boardBuilderToggle.labels.length)
            {
                boardBuilderToggle.labels[0].style.top = getBoardBuilderToggleLabelTop();
                boardBuilderToggle.labels[0].style.left = getBoardBuilderToggleLabelLeft();
            }
            boardBuilder.style.visibility = ""; 
            boardBuilderToggle.style.visibility = ""; 
        }
        if (multiplayerForm)
        {
            multiplayerForm.style.top = getMultiplayerFormTop();
            multiplayerForm.style.left = getMultiplayerFormLeft();
            multiplayerForm.style.visibility = "";   
        }
    }
    else
    {
        runButton.style.visibility = "hidden"; 
        stopButton.style.visibility = "hidden";
        darkModeToggle.style.visibility = "hidden"; 
        darkModeLabel.style.visibility = "hidden"; 
        if (boardBuilder && boardBuilderToggle)
        {
            boardBuilder.style.visibility = "hidden"; 
            boardBuilderToggle.style.visibility = "hidden"; 
        }
        if (multiplayerForm)
        {
            multiplayerForm.style.visibility = "hidden";   
        }
    }
}


function cacheElementsForStyling(thisGame)
{
    if (thisGame.previewing)
    {
        window.cacheElements = [
            document.getElementById("Foundation_Elemental_1_content").cloneNode(true),
            document.getElementById("Foundation_Elemental_1_title_0").cloneNode(true),
            document.getElementById("Foundation_Elemental_1_title_1").cloneNode(true),
            document.getElementById("Foundation_Elemental_1_title_2").cloneNode(true),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(1)").cloneNode(true),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(3)").cloneNode(true),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(5)").cloneNode(true),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(7)").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageRead").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_playerNotes").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageWrite").cloneNode(true),
            document.querySelector("body > div > div:nth-child(6)").cloneNode(true)
        ];
    }
    else
    {
        window.cacheElements = [
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageRead").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_playerNotes").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageWrite").cloneNode(true),
        ];
    }
}


function maybeStylePage(isDarkMode)
{
    resetButtonPositions();
    let content = getDocumentContent(); 
    if (isDarkMode)
    {
        if(isNotDark(content))
        {
            applyDarkMode(content);
        }
    }
    else
    {   
        if(isNotLight(content))
        {
            applyLightMode(content);
        }
    }
}


function isNotDark(content)
{
    return (content.style.backgroundColor !== 'slategrey');
}


function isNotLight(content)
{
    return (content.style.backgroundColor !== 'rgb(238, 238, 255)');
}


function applyDarkMode(content)
{
    let thisGame = GamesByEmail.findFirstGame();
    if (thisGame.previewing)
    {
        document.body.style.backgroundColor = 'dimgrey';
        content.style.backgroundColor = 'slategrey';
        window.cacheContentBackgroundColor = content.style.backgroundColor;
        content.style.border = '';
        let title_0 = document.getElementById("Foundation_Elemental_1_title_0");
        let title_1 = document.getElementById("Foundation_Elemental_1_title_1");
        let title_2 = document.getElementById("Foundation_Elemental_1_title_2");
        title_0.style.backgroundColor = 'grey'
        title_1.style.backgroundColor = 'grey';
        title_2.style.backgroundColor = 'lightgrey';
        title_0.style.border = '';
        title_1.style.border = '';
        title_2.style.border = '';
        let titleSpacer0 = document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(1)");
        let titleSpacer1 = document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(3)");
        let titleSpacer2 = document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(5)");
        let titleSpacer3 = document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(7)");
        if (titleSpacer0 && titleSpacer1 && titleSpacer2 && titleSpacer3)
        {
            titleSpacer0.style.border = '';
            titleSpacer1.style.border = '';
            titleSpacer2.style.border = '';
            titleSpacer3.style.border = '';
        }
        let bottomDiv = document.querySelector("body > div > div:nth-child(6)");
        if (bottomDiv)
        {
            bottomDiv.style.backgroundColor = 'grey';
            bottomDiv.style.border = '';
        }
    }
    else
    {
        content.style.backgroundColor = 'slategrey';
    }
    let gameMessageRead = document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageRead");
    let playerNotes = document.getElementById("Foundation_Elemental_" + gameVersion + "_playerNotes");
    let gameMessageWrite = document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageWrite");
    gameMessageRead.style.backgroundColor = 'lightgrey';
    playerNotes.style.backgroundColor = 'lightgrey';
    gameMessageWrite.style.backgroundColor = 'lightgrey';
}


function applyLightMode(content)
{
    document.body.style.backgroundColor = '';
    const thisGame = GamesByEmail.findFirstGame();
    let pageElements = null;
    if (thisGame.previewing)
    {
        pageElements = [
            content,
            document.getElementById("Foundation_Elemental_1_title_0"),
            document.getElementById("Foundation_Elemental_1_title_1"),
            document.getElementById("Foundation_Elemental_1_title_2"),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(1)"),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(3)"),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(5)"),
            document.querySelector("#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(7)"),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageRead"),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_playerNotes"),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageWrite"),
            document.querySelector("body > div > div:nth-child(6)")
        ]
    }
    else
    {
        pageElements = [
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageRead"),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_playerNotes"),
            document.getElementById("Foundation_Elemental_" + gameVersion + "_gameMessageWrite")
        ]
    }
    for (let index = 0; index < pageElements.length; index++)
    {
        if (pageElements[index] && window.cacheElements[index])
        {
            for (let property in pageElements[index].style)
            {
                pageElements[index].style[property] = window.cacheElements[index].style[property];
            }
        }
    }
    window.cacheContentBackgroundColor = content.style.backgroundColor;
}


function hideEndTurnButtons()
{
    let endMovementButton = document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyMovement");
    if (endMovementButton)
    {
        endMovementButton.disabled = true;
        endMovementButton.style.visibility = "hidden";
    }
    let endTurnButton = document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyTurn");
    if (endTurnButton)
    {
        endTurnButton.disabled = true;
        endTurnButton.style.visibility = "hidden";
    }
}


function showEndTurnButtons()
{
    let endMovementButton = document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyMovement");
    if (endMovementButton)
    {
        endMovementButton.disabled = false;
        endMovementButton.style.visibility = "visible";
    }
    let endTurnButton = document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyTurn");
    if (endTurnButton)
    {
        endTurnButton.disabled = false;
        endTurnButton.style.visibility = "visible";
    }
}

/// === Touch Support ===

// Maps touch to mouse, includes custom click and right click / long touch.
// For some actions, skip the mouse event and pass to the game handler.  
function touchHandler(event)
{
    // Ignore multi-touch to allow scroll and zoom.
    if (event.type === "touchmmove" && (event.touches.length > 1 || event.changedTouches.length > 1))
    {
        return;
    }
    let firstTouch = event.changedTouches[0];
    const xOffset = document.getElementById("Foundation_Elemental_" + gameVersion + "_pieces").getBoundingClientRect().left + window.scrollX;
    const yOffset = document.getElementById("Foundation_Elemental_" + gameVersion + "_pieces").getBoundingClientRect().top + window.scrollY; 
    const screenPoint = new Foundation.Point(firstTouch.pageX - xOffset, firstTouch.pageY - yOffset);
    if (isInsideHitBox(firstTouch))
    {
        event.preventDefault();
        const thisGame = Foundation.$registry[gameVersion];
        let mouseButton = window.mouseButton ? window.mouseButton : 0;
        let eventType = "";
        switch(event.type)
        {
            case "touchstart": 
                if (isPlacingMapCustomization(thisGame))
                {
                    thisGame.customizeMapOnMouseMove(screenPoint);
                    return;
                }
                else if (firstTouch.target.tagName === "BUTTON" || firstTouch.target.tageName === "INPUT")
                {
                    eventType = "click";
                    mouseButton = 0;
                }
                else
                {
                    if (isPlacingCapital(thisGame))
                    {
                        thisGame.placeCapitalMouseDown(screenPoint);
                        return;
                    }
                    eventType = "mousedown"; 
                    window.mouseDownTime = event.timeStamp; 
                    window.mouseStartLocation = firstTouch; 
                }
                break;
            case "touchmove":  
                if (isLongTouchRightClick(event.timeStamp, firstTouch))
                {
                    eventType = "mousedown"
                    mouseButton = 2;
                    window.mouseButton = 2;
                    firstTouch = window.mouseStartLocation;
                }
                else
                {
                    if (isPlacingReserves(thisGame))
                    {
                        thisGame.placeReserveOnMouseMove(screenPoint);
                        return;
                    }
                    eventType = "mousemove"; 
                }
                break;        
            case "touchend":
                if (isPlacingReserves(thisGame))
                {
                    thisGame.placeReserveOnMouseUp(screenPoint);
                    return;
                }
                else if (isPlacingCapital(thisGame))
                {
                    thisGame.placeCapitalMouseDown(screenPoint);
                    return;
                }
                else if (isTap(event.timeStamp))
                {
                    eventType = "click";
                    mouseButton = 0;
                }
                else
                {
                    eventType = "mouseup";                   
                }
                break;
            default:           
                return;
        }
        // Fire mouse event.
        let mouseEvent = new MouseEvent(eventType, {
                                                bubbles: true,
                                                cancelable: true,
                                                view: window,
                                                screenX: firstTouch.screenX,
                                                screenY: firstTouch.screenY,
                                                clientX: firstTouch.clientX,
                                                clientY: firstTouch.clientY,
                                                button: mouseButton
                                            });
        firstTouch.target.dispatchEvent(mouseEvent);
        // Maybe reset.
        if(eventType === "mouseup" || eventType === "click")
        {
            resetOnMouseUp(thisGame);
        }
    }
}


function isInsideHitBox(touch)
{
    return (
        touch.pageX > touchHitBox.left && 
        touch.pageX < touchHitBox.right && 
        touch.pageY > touchHitBox.top && 
        touch.pageY < touchHitBox.bottom
    );
}


function isPlacingMapCustomization(thisGame)
{
    return thisGame.onMouseMove === "customizeMapOnMouseMove";
}


function isPlacingCapital(thisGame)
{
    return thisGame.onMouseMove === "placeCapitalMouseMove";
}


function isPlacingReserves(thisGame)
{
    return (thisGame.onMouseMove === "placeReserveOnMouseMove" ||
            thisGame.onMouseUp === "placeReserveOnMouseUp" ? true : false);
}


function isLongTouchRightClick(timeNow, firstTouch)
{
    return (timeNow - window.mouseDownTime > 1000 && 
        Math.abs(firstTouch.pageX - window.mouseStartLocation.pageX) < 25 && 
        Math.abs(firstTouch.pageY - window.mouseStartLocation.pageY) < 25 );
}


function isTap(timeNow)
{
    return (window.mouseDownTime && timeNow - window.mouseDownTime < 200);
}


function resetOnMouseUp(thisGame)
{
    window.mouseButton = 0;
    thisGame.maybeResetReservesByMouseUp();
    setTimeout(function(){
        if (!needsPlayerCommit())
        {
            thisGame.setTargetPoints(null);
            thisGame.pieces[61].setVisibility(true);
        }
        thisGame.pieces.updateUnitDisplays()
    }, 200);
}


function needsPlayerCommit()
{
    return document.querySelector("#Foundation_Elemental_" + gameVersion + "_overlayCommit");
}


function addTouchSupport() 
{
    document.body.style.touchAction = 'auto';
    window.touchHitBox = getTouchHitBox();
    document.addEventListener("touchstart", touchHandler,  {passive:false} );
    document.addEventListener("touchmove", touchHandler,  {passive:false} );
    document.addEventListener("touchend", touchHandler,  {passive:false} );
}


function getTouchHitBox()
{
    const mouseEventClientRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_mouseEventContainer').getBoundingClientRect();
    const pageTop = window.scrollY + mouseEventClientRect.top - 10;
    const pageRight = window.scrollX + mouseEventClientRect.right + 10;
    const pageLeft = window.scrollX + mouseEventClientRect.left - 5;
    const pageBottom = window.scrollY + mouseEventClientRect.bottom + 50;

    return (
        {	
            "top" : pageTop,
            "right" : pageRight,
            "left" : pageLeft,
            "bottom" : pageBottom	
        }
    )
}

/// === Board Builder ===

function addBoardBuilder(thisGame)
{
    if (thisGame.previewing && isOnPreviewTab())
    {
        const boardBuilderDiv = document.createElement('div');
        boardBuilderDiv.id = "BoardBuilder";
        boardBuilderDiv.style.display = 'flex';
        boardBuilderDiv.style.flexDirection = 'column';
        boardBuilderDiv.style.position = "absolute";
        boardBuilderDiv.style.top = getBoardBuilderTop();
        boardBuilderDiv.style.left = getBoardBuilderLeft();
        boardBuilderDiv.style.fontSize = "10px";
        boardBuilderDiv.style.fontFamily = "Verdana";
        boardBuilderDiv.style.padding = '4px';
        boardBuilderDiv.innerText = "Board Builder";
        document.body.appendChild(boardBuilderDiv);
    
        window.isTerrainSelected = {};
        const inputOptions = [
            {value: 'Plains'},
            {value: 'Grass'},
            {value: 'Forest'},
            {value: 'Mountain'},
            {value: 'Water'}
        ];
        inputOptions.forEach(option => {
            window.isTerrainSelected[option.value] = false;
            const radioButtons = createRadioButton(option.value, addTerrainInputListener);
            boardBuilderDiv.appendChild(radioButtons);
        });
        addBoardBuilderToggle();
    }
}


function createRadioButton(value, addListener, groupName = 'RadioGroup_') {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.marginBottom = '2px';
    const radioButton = document.createElement('input');
    radioButton.type = 'radio';
    radioButton.name = groupName;
    radioButton.value = value;
    radioButton.id = groupName + value; 
    radioButton.style.marginRight = '6px';
    addListener(radioButton);
    const label = document.createElement('label');
    label.innerText = value;
    label.htmlFor = radioButton.id; 
    label.style.fontSize = "10px";
    label.style.fontFamily = "Verdana";
    container.appendChild(radioButton);
    container.appendChild(label);
    return container;
}


function addTerrainInputListener(radioButton)
{
    radioButton.addEventListener('change', () => 
        {
            Object.keys(window.isTerrainSelected).forEach(key => { isTerrainSelected[key] = false; });
            isTerrainSelected[radioButton.value] = true;
            radioButton.checked = isTerrainSelected[radioButton.value] ? true : false; 
            console.log("Pressed: " + radioButton.value);
            enableBoardBuilder();
        }
    )
}


function getBoardBuilderTop()
{
    // const playerNotesOffset = 156;
    const playerNotesOffset = 14;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset + 'px');
}


function getBoardBuilderLeft()
{
    const playerNotesOffset = 200;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.3;
    return (window.scrollX + playerNotesMidwayX + playerNotesOffset + 'px');
}


function addBoardBuilderToggle()
{
    let toggle = document.createElement("input");
    toggle.setAttribute("type", "checkbox");
    toggle.id = "BoardBuilderToggle";
    toggle.addEventListener('click', boardBuilderToggleMouseClick);
	let style = {position: 'absolute', top: getBoardBuilderToggleTop(), left:getBoardBuilderToggleLeft(), 'z-index': '9999'};
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    document.body.appendChild(toggle);
    // Toggle Label
    let toggleLabel = document.createElement("label");
    toggleLabel.htmlFor = "BoardBuilderToggle";
    toggleLabel.innerText = "On";
    style = {position: 'absolute', top: getBoardBuilderToggleLabelTop(), left: getBoardBuilderToggleLabelLeft(), 'z-index': '9999', 'font-size': '8px'};
    Object.keys(style).forEach(key => toggleLabel.style[key] = style[key]);
    document.body.appendChild(toggleLabel);
}


function getBoardBuilderToggleTop()
{
    const boardBuilderTop = 12;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + boardBuilderTop + 'px');
}


function getBoardBuilderToggleLeft()
{
    const boardBuilderLeft = 272;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.3;
    return (window.scrollX + playerNotesMidwayX + boardBuilderLeft + 'px');
}


function getBoardBuilderToggleLabelTop()
{
    const boardBuilderTop = 17;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + boardBuilderTop + 'px');
}


function getBoardBuilderToggleLabelLeft()
{
    const boardBuilderLeft = 292;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.3;
    return (window.scrollX + playerNotesMidwayX + boardBuilderLeft + 'px');
}


function boardBuilderToggleMouseClick(event, toggle)
{
    toggle = event ? event.currentTarget : toggle;
    const thisGame = Foundation.$registry[gameVersion];
    if (toggle.checked)
    {
        stopAndReset();
        window.cacheMovePhase = thisGame.movePhase;
        thisGame.movePhase = -1;
        thisGame.update();
        document.addEventListener('mousedown', boardBuilderMouseDown);
        document.addEventListener('mousemove', boardBuilderMouseMove);
        document.addEventListener('mouseup', boardBuilderMouseUp);
        console.log("Board Builder: On");
        thisGame.maybeHideOverlay();
        if (thisGame.playOptions.mapCustomizationData.length > 0)
        {
            thisGame.customizeMapDoAll(true);
        }
        maybeSelectDefaultTerrain();
        setTimeout(function(){}, 1)
        {
            const title = document.getElementById("Foundation_Elemental_" + gameVersion + "_gameState");            
            title.innerText = "Board Builder";
            title.style.backgroundColor = "darkseagreen"
            const content = getDocumentContent();
            window.cacheContentBackgroundColor = content.style.backgroundColor;
            content.style.backgroundColor = "seagreen";
            content.style.cursor = "cell";
            for (const piece of thisGame.pieces)
            {
                if (thisGame.isTargetPoint(piece.boardPoint))
                {
                    piece.setBorder(false);  
                }
            } 
            const prompt = document.getElementById("Foundation_Elemental_" + gameVersion + "_gamePrompts");
            prompt.innerText = "Game is paused. Customize terrain on any hex, then switch off the Board Builder to resume play.";
        }
    }
    else
    {
        thisGame.movePhase = window.cacheMovePhase;
        const content = getDocumentContent();
        content.style.backgroundColor = window.cacheContentBackgroundColor;
        content.style.cursor = "auto";
        const title = document.getElementById("Foundation_Elemental_" + gameVersion + "_gameState");  
        title.style.backgroundColor = "";
        document.removeEventListener('mousedown', boardBuilderMouseDown);
        document.removeEventListener('mousemove', boardBuilderMouseMove);
        document.removeEventListener('mouseup', boardBuilderMouseUp);
        console.log("Board Builder: Off");
        thisGame.update();
        thisGame.removeExcessPieces(0, true);
        thisGame.removeExcessPieces(1, true);
    }
}


function getDocumentContent()
{
    const content = document.getElementById("Foundation_Elemental_1_content");
    return content ? content : document.body;
}


function boardBuilderMouseDown(event)
{
    if (isBoardBuilderDisabled())
    {
        return; 
    }
    maybeSelectDefaultTerrain();
    const xOffset = document.getElementById("Foundation_Elemental_" + gameVersion + "_pieces").getBoundingClientRect().left + window.scrollX; 
    const yOffset = document.getElementById("Foundation_Elemental_" + gameVersion + "_pieces").getBoundingClientRect().top + window.scrollY; 
    const screenPoint = new Foundation.Point(event.pageX - xOffset, event.pageY - yOffset); 
    const thisGame = Foundation.$registry[gameVersion];
    boardPoint = thisGame.boardPointFromScreenPoint(screenPoint);   
    piece = thisGame.pieces.findAtPoint(boardPoint);
    const reserveIndex = thisGame.pieces.length - 1;
    const isValidHex = (piece && (piece.index !== reserveIndex) && !piece.isPerimeter());
    if (isValidHex)
    {
        const newLand = "l";
        const boardValues = {
            "Plains" : "p",
            "Grass" : "g",
            "Forest" : "f",
            "Mountain" : "m",
            "Water" : "w"
        } 
        for (key in window.isTerrainSelected)
        {
            if (isTerrainSelected[key])
            {
                piece.boardValue = newLand;
                piece.setValue(boardValues[key], false);
                piece.hidden = false;
                piece.setVisibility(piece.hidden); 
                const visible = 2;
                let boardVisArray = thisGame.boardVisibility.split("");
                boardVisArray[piece.index] = visible;
                thisGame.boardVisibility = boardVisArray.join("");
            }        
        }
    }
    window.isMouseDown = true;
}


function maybeSelectDefaultTerrain()
{
    for (const terrain in window.isTerrainSelected)
    {
        if (window.isTerrainSelected[terrain] === true)
        {
            return;
        }
    }        
    let radioButton = document.getElementById("RadioGroup_Plains");
    if (radioButton)
    {
        radioButton.checked = true;
        window.isTerrainSelected.Plains = true;
    }
}


function boardBuilderMouseMove(event)
{
    if (window.isMouseDown)
    {
        boardBuilderMouseDown(event);
    }
}


function boardBuilderMouseUp(event)
{
    window.isMouseDown = false;
}


function disableBoardBuilder()
{
    const toggle = document.getElementById("BoardBuilderToggle");
    if (toggle && toggle.checked)
    {
        toggle.checked = false;
        boardBuilderToggleMouseClick(null, toggle);
    }
}


function isBoardBuilderDisabled()
{
    const toggle = document.getElementById("BoardBuilderToggle");
    return (!toggle || !toggle.checked) ? true : false;
}


function enableBoardBuilder()
{
    if (!isOnPreviewTab())
    {
        return;
    }
    const toggle = document.getElementById("BoardBuilderToggle");
    if (toggle && !toggle.checked)
    {
        toggle.checked = true;
        boardBuilderToggleMouseClick(null, toggle);
    }
}

/// === Local Multiplayer ===

function addLocalMultiplayer(thisGame)
{
    if (thisGame.previewing)
    {
        const multiplayerForm = document.createElement('div');
        multiplayerForm.id = "MultiplayerForm";
        multiplayerForm.style.display = 'flex';
        multiplayerForm.style.flexDirection = 'column';
        multiplayerForm.style.position = "absolute";
        multiplayerForm.style.top = getMultiplayerFormTop();
        multiplayerForm.style.left = getMultiplayerFormLeft();
        multiplayerForm.style.fontSize = "10px";
        multiplayerForm.style.fontFamily = "Verdana";
        multiplayerForm.style.padding = '4px';
        multiplayerForm.innerText = "Local Multiplayer";
        document.body.appendChild(multiplayerForm);
        addMultiplayerRestartButton(thisGame, multiplayerForm);
        window.isPlayerCountSelected = {};
        const inputOptions = [
            {value: '2 Player'},
            {value: '3 Player'},
            {value: '4 Player'},
            {value: '5 Player'},
            {value: '6 Player'},
            {value: '7 Player'},
            {value: '8 Player'},
        ];
        inputOptions.forEach(option => {
            window.isPlayerCountSelected[option.value] = false;
            const radioButton = createRadioButton(option.value, addMultiplayerInputListener);
            radioButton.style.visibility = "hidden"; 
            multiplayerForm.appendChild(radioButton);
        });
    }
}


function addMultiplayerInputListener(radioButton)
{
    radioButton.addEventListener('change', () => 
        {
            Object.keys(window.isPlayerCountSelected).forEach(key => { isPlayerCountSelected[key] = false; });
            isPlayerCountSelected[radioButton.value] = true;
            radioButton.checked = isPlayerCountSelected[radioButton.value] ? true : false; 
            console.log("Pressed: " + radioButton.value);
            const playerCount = radioButton.value[0] * 1;
            const formIndex = Foundation.$registry.length - 1;
            const playButton = document.getElementById("Foundation_Elemental_" + formIndex + "_PlayButton");
            if (playButton)
            {
                setupNextGamePlayers(playerCount, formIndex);
            }
        }
    )
}


function setupNextGamePlayers(playerCount, formIndex)
{
    Foundation.$registry[formIndex].numPlayers = playerCount;
    Foundation.$registry[formIndex].players = [];
    while (Foundation.$registry[formIndex].players.length < playerCount)
    {
        let nextPlayer = Foundation.$registry[formIndex].players.length + 1;
        Foundation.$registry[formIndex].players.unshift({title: 'Player ' + nextPlayer, id: nextPlayer.toString(), mode: 3, rank: 0, playerId: nextPlayer - 1});
    }
    const newGameButton = document.getElementById("MultiplayerRestartButton");
    newGameButton.style.backgroundColor = "lightgreen";
}


function getMultiplayerFormTop()
{
    const playerNotesOffset = 14;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset + 'px');
}


function getMultiplayerFormLeft()
{
    const playerNotesOffset = 174;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.4;
    return (window.scrollX + playerNotesMidwayX + playerNotesOffset + 'px');
}


function multiplayerRestartButtonMouseClick(thisGame)
{
    stopAndReset();
    disableBoardBuilder();
    expandMultiplayerForm();
    const formIndex = Foundation.$registry.length - 1;
    const playButton = document.getElementById("Foundation_Elemental_" + formIndex + "_PlayButton");
    const startAnotherButton = document.getElementById("Foundation_Elemental_" + gameVersion + "_startAnotherGame");
    if (playButton)
    {
        for (let playerCount in window.isPlayerCountSelected)
        {
            if (window.isPlayerCountSelected[playerCount] === true)
            {
                playerCount = playerCount[0] * 1;
                setupNextGamePlayers(playerCount, formIndex);
                break;
            }
        }   
        hideMultiplayerForm();
        Foundation.$registry[formIndex].play();
    }
    else if (startAnotherButton)
    {
        thisGame.startAnotherGame(); 
    }
    else
    {
        if (!isOnPreviewTab() || !document.getElementById("Foundation_Elemental_" + gameVersion + "_resign"))
        {
            thisGame.sendMove();
            setTimeout(function()
            {
                if (isOnPreviewTab() && document.getElementById("Foundation_Elemental_" + gameVersion + "_resign"))
                {
                    thisGame.resign();
                    thisGame.startAnotherGame();
                }
                else
                {
                    const button = document.getElementById("MultiplayerRestartButton");
                    button.innerText = isOnPreviewTab() ? "Plz End Turn" : "Use Preview Tab";
                    setTimeout(function()
                    {
                        button.innerText = "New Game";
                    }, 1600);
                }
            }, 200)
        }
        else
        {
            thisGame.resign();
            thisGame.startAnotherGame();
        }    
    }
    setTimeout(function(){ 
        hideDefaultPlayControls()
        maybeSelectDefaultPlayerCount(); 
        resetButtonPositions();
    }, 1200);
}


function expandMultiplayerForm()
{
    if (!isOnPreviewTab())
    {
        return;
    }
    const form = document.getElementById("MultiplayerForm");
    form.style.backgroundColor = 'lightgrey';
    form.style.border = 'thick solid darkgrey';
    const newGameButton = form.firstElementChild;
    newGameButton.innerText = "Click to Begin";
    for (let i = 1; i < form.children.length; i++)
    {
        let radioButton = form.children[i];
        radioButton.style.visibility = "visible";
    }
}


function hideMultiplayerForm()
{
    const form = document.getElementById("MultiplayerForm");
    form.style.backgroundColor = ''
    form.style.border = '';
    const newGameButton = form.firstElementChild;
    newGameButton.style.backgroundColor = "";
    newGameButton.innerText = "Loading...";
    setTimeout(function()
    {
        newGameButton.innerText = "New Game";
    }, 1200);
    for (let i = 1; i < form.children.length; i++)
    {
        let radioButton = form.children[i];
        radioButton.style.visibility = "hidden"
    }
}


function hideDefaultPlayControls()
{
    const formIndex = Foundation.$registry.length - 1;
    const playButton = document.getElementById("Foundation_Elemental_" + formIndex + "_PlayButton");
    if (playButton)
    {
        clearIntervalsAndTimers();
        playButton.style.visibility = "hidden";
        const cancelButton = document.getElementById("Foundation_Elemental_" + formIndex + "_CancelButton");
        cancelButton.style.visibility = "hidden";
    }
}


function maybeSelectDefaultPlayerCount()
{
    for (const playerCount in window.isPlayerCountSelected)
    {
        if (window.isPlayerCountSelected[playerCount] === true)
        {
            return;
        }
    }        
    let radioButton = document.getElementById("RadioGroup_2 Player");
    if (radioButton)
    {
        radioButton.checked = true;
        window.isPlayerCountSelected["2 Player"] = true;
    }
}


function isOnPreviewTab()
{
    return (window.location.href === 'http://gamesbyemail.com/Games/Viktory2#Preview');
}


function addMultiplayerRestartButton(thisGame, form)
{
    let button = document.createElement("button");
    button.setAttribute("type", "button");
    button.id = "MultiplayerRestartButton";
    button.innerText = "New Game";
    button.style.fontSize = "10px";
    button.style.fontFamily = "Verdana";
    button.addEventListener('click', function(){ multiplayerRestartButtonMouseClick(thisGame) });
    form.appendChild(button);
}

