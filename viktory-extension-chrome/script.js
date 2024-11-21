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
        addTouchSupport();
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
        }
        // Add global error handling
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
        if (thisGame.player.isMyTurn())
        {
            resetGlobals();
            disableBoardBuilder();
            styleButtonForRun();
            runKomputer(thisGame);
        }
        else
        {
            window.isKomputerReady = false;
            const isGameWon = thisGame.movePhase === 0;
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
    window.isLargeBoard = thisGame.pieces.length === 92;
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
                const frigates = findFrigates(thisGame, thisGame.perspectiveColor);
                moveEachUnit(thisGame, frigates, moveIntervalPeriod, plan);
                break;
            }
            case 2: {
                console.log("May move all available.");
                let army = findAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                const navy = findFrigates(thisGame, thisGame.perspectiveColor);
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
            if (unit.color === color && unit.type !== "f" && ( unit.canMove() || unit.canBombard()) && !unit.holding)
            {
                landUnits.push(unit);
            }
        }
    }
    return landUnits;
}


function orderFromFarthestToEnemy(thisGame, units, reverse)
{
    const enemyColor = !thisGame.perspectiveColor * 1;
    let enemyArmies = getArmyUnits(thisGame, enemyColor);
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


function findFrigates(thisGame, color)
{
    let frigates = [];
    for (const piece of thisGame.pieces)
    {
        // Skip reserves and any battle.
        if (piece.valueIndex === - 1 || piece.hasBattle(thisGame.perspectiveColor, -1))
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (unit.color === color && unit.type === "f")
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
        // Check for any battle that should be fought before further moves.
        if (thisGame.hasBattlesPending && !isExploring && !isUnloading)
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
        const unit = movableUnits[getNextUnitIndex(movableUnits)];
        const firstMoveWave = 0;
        const finalMoveWave = 2;
        const mayMoveThisWave = decideMayMoveThisWave(thisGame, unit, firstMoveWave, finalMoveWave);
        if (mayMoveThisWave)
        {
            const possibleMoves = unit.getMovables();
            if (possibleMoves)
            {
                // Decide best move, or don't accept any to stay.
                const isEarlyMover = decideIsEarlyMover(thisGame, firstMoveWave, movableUnits.length);
                const bestMove = decideBestMove(thisGame, possibleMoves, unit, isEarlyMover);
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
                            if (normalPopup || document.getElementById("Foundation_Elemental_" + gameVersion + "_customizeMapDoAll"))
                            {
                                window.isExploring = true;
                                if (normalPopup)
                                {
                                    thisGame.overlayCommitOnClick();
                                }
                                setTimeout(function(){
                                    settleExploredTerrain(thisGame, unit);
                                }, 200);
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
                            movableUnits.push(movableUnits.splice(window.movingUnitIndex, 1)[0]);
                            clearMovementFlags();
                        }   
                    }, 300);
                } // End if shouldAcceptMove
            } // End if possibleMoves
            setTimeout(function(){
                window.isManeuveringToAttack = (window.isManeuveringToAttack && !unit.movementComplete && !unit.holding) ? true : false;}, 350);
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


function getNextUnitIndex(movableUnits)
{
    return window.movingUnitIndex < movableUnits.length ? window.movingUnitIndex : movableUnits.length - 1;
}


function decideIsEarlyMover(thisGame, firstMoveWave, movingUnitsLength)
{
    const isEarlyMoverConsidered = thisGame.maxMoveNumber > 25 && movingUnitsLength > 2;
    return (isEarlyMoverConsidered && window.moveWave === firstMoveWave && window.movingUnitIndex < (movingUnitsLength * 0.4))
}


function decideMayMoveThisWave(thisGame, unit, firstMoveWave, finalMoveWave)
{
    if (isNotValidUnit(thisGame, unit))
    {
        window.isManeuveringToAttack = false;
        window.isBombarding = false;
        return false;
    }
    if(window.isExploring || window.isBombarding)
    {
        window.isManeuveringToAttack = false;
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
    thisGame.customizeMapDoAll(true);
    window.explorationId = setInterval(function(){
        if (isDoneExploring(thisGame))
        {  
            clearInterval(window.explorationId);
            window.isExploring = false;
        } 
        setTimeout(function(){
            const invalidPiece = thisGame.pieces.findByBoardValue("l");
            if (invalidPiece)
            {
               fixPiecesPendingValue(thisGame, invalidPiece)
            }
        }, 200)
    }, 720);
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
    if (window.isExploring || window.isBombarding || window.isUnloading || window.isManeuveringToAttack)
    {
        // Pass: wait for these to finish.
    }
    else if (shouldBombard(thisGame, unit, finalMoveWave))
    {
        window.isBombarding = true;
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
    const enemyColor = !thisGame.perspectiveColor * 1;
    return (unit && unit.piece && unit.canBombard() && (unit.movementComplete || moveWave >= finalMoveWave) &&
        (hasAdjacentEnemyArmy(thisGame, unit.piece) || hasAdjacentFrigate(thisGame, unit.piece, enemyColor)));
}


function decideBestMove(thisGame, possibleMoves, unit, isEarlyMover)
{
    let bestMoveScore = -1;
    let bestMoves = [];
    for (const possibleMove of possibleMoves)
    {
        const possibleMoveScore = getMoveScore(thisGame, possibleMove, unit, isEarlyMover);
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


function getMoveScore(thisGame, possibleMove, unit, isEarlyMover)
{
    const piece = thisGame.pieces.findAtXY(possibleMove.x, possibleMove.y);
    const enemyColor = !thisGame.perspectiveColor * 1;
    if (unit.isFrigate())
    {
        return getFrigateMoveScore(thisGame, piece, unit, enemyColor);
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
        }
        // Try to beseige / pin enemy cities and towns, on the safest terrain.
        else if (hasAdjacentEnemyCivilization(thisGame, piece) || 
            (hasAdjacentEnemyArmy(thisGame, piece) && hasAdjacentBattle(thisGame, piece)))
        {
            score = hasAdjacentEnemyCivilization(thisGame, piece) ? 0.7 + terrainDefenseBonus : 0.6 + terrainDefenseBonus;
            // If already in an ideal seige location, value another one less.
            if ((unit.piece.isMountain()) && hasAdjacentEnemyCivilization(thisGame, unit.piece))
            {
                score -= 0.0625;
            }
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
                    // If the unit boards a frigate, don't raise the maneuvering flag, so that the frigate can take control.
                    if (!piece.hasFrigate(thisGame.perspectiveColor))
                    {
                        window.isManeuveringToAttack = true;
                    }
                    return 1;
                }
            }
        }
        // Give importance to own civ defense.
        else if (piece.hasCivilization(thisGame.perspectiveColor))
        {
            const isEarlyGame = thisGame.maxMoveNumber < 25;
            const centerWeight = isEarlyGame ? getEuclideanDistanceToPoint(getCenterPieceBoardPoint(thisGame), piece.boardPoint) : 0;
            const isPinned = hasAdjacentEnemyArmy(thisGame, piece);
            const defensivePower = isPinned ? calculateDefensivePower(thisGame, piece) : 0;
            const threat = isPinned ? guessThreat(thisGame, piece) : 0;
            score = (isPinned && defensivePower < threat) ? ( piece.hasCapital(thisGame.perspectiveColor) || (defensivePower < 3) ) ? 0.95 + (0.04 * Math.random()) : 0.92 + (0.04 * Math.random()): (0.7 / (guessTravelCostToEnemy(thisGame, unit, piece, enemyColor) + centerWeight));
            // Early movers emphasize offense.
            if (isEarlyMover && score > 0.7)
            {
                score -= 0.125;
            }
        }
        // Consider boarding a frigate.
        else if (piece.hasFrigate(thisGame.perspectiveColor))
        {
            const frigate = piece.findFrigate(thisGame.perspectiveColor);
            const canReachEnemy = hasReachableEnemy(thisGame, frigate, true);
            const hasCargo = frigate.cargo.length > 0;
            score = ((!frigate.movementComplete && canReachEnemy) || hasAdjacentEnemyCivilization(thisGame, piece) || hasAdjacentEnemyArmy(thisGame, piece)) ? 0.82 : 0.62;
            // More likely board if others on board.
            if ( hasCargo || (canReachEnemy && Math.random() < 0.6))
            {
                // Results in a range of [0.945, 0.97625], so it may compete with any other attacking or defending moves, except maximum priority ones.
                // Boarding with enough force to make a difference is often critical to be worthwhile.
                score += 0.125 + (0.03125 * Math.random());
            }
        }
        // Move towards an enemy target, ending on the safest terrain.
        else
        {
            const travelCostToEnemy = guessTravelCostToEnemy(thisGame, unit, piece, enemyColor);
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
            if (thisGame.maxMoveNumber < 12 && (piece.index === 15 || piece.index === 22))
            {
                score += 0.125;
            }
        }
        // Clamp and dampen score. Special cases return up to including 1. 
        score = score < 0 ? 0 : score > 1 ? 0.95 : score;
        return score;
    }
}


function getCenterPieceBoardPoint(thisGame)
{
    const centerPieceIndex = Math.floor((thisGame.pieces.length / 2) - 1);
    return thisGame.pieces[centerPieceIndex].boardPoint; 
}


function getEuclideanDistanceToPoint(pointA, pointB)
{
    return Math.sqrt((pointA.x-pointB.x)*(pointA.x-pointB.x)+(pointA.y-pointB.y)*(pointA.y-pointB.y));
}


function guessTravelCostToEnemy(thisGame, unit, pieceOrigin, enemyColor)
{    
    const maxDistance = 44;
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
        const enemyCapital = thisGame.pieces.findCapitalPiece(enemyColor);
        return thisGame.distanceBewteenPoints(pieceOrigin.boardPoint, enemyCapital.boardPoint);
    }
    return travelCost;
}


function getFrigateMoveScore(thisGame, piece, unit, enemyColor)
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
            if ((unit.piece.isPerimeter() && hasAdjacentDeepWater(thisGame, civPiece)) || hasAdjacentAccessibleInlandSea(thisGame, civPiece, unit))
            {
                coastalCivs.push(civPiece);
            }
        } 
        const targetCivs = coastalCivs.length > 0 ? coastalCivs : enemyCivs;
        const distance = getDistanceToNearestFrigateTarget(thisGame, targetCivs, piece);
        const distanceWeight = distance ? (1 - 0.1 * distance) : 1;
        score = 0.7 * distanceWeight;
        const defenderCount = piece.countOpponentMilitary(thisGame.perspectiveColor); 
        const defenderWeight = defenderCount ? 1 - (0.03125 * defenderCount) : 1; 
        const hitTarget = distance === 0;
        score += hitTarget ? 0.125 * defenderWeight : 0;
        score += piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) ? 
            isAdjacent(thisGame, unit.piece.boardPoint, piece.boardPoint) ? 0.125 : 0.09375 : 0;
        score += piece.hasOpponentTown(thisGame.perspectiveColor) && !piece.isMountain() ? 0.0625 : 0;
        score += piece.hasOpponentCivilization(thisGame.perspectiveColor) ? 0.03125 : 
                piece.isMountain() ? 0.01875 : piece.isForest() ? 0.01125 : 0;
        if (hasEnemyFrigate)
        {
            score -= 0.03125;
        }
    }
    else
    {
        // Unloaded frigates should support friendlies.
        let friendlyArmyUnits = getArmyUnits(thisGame, thisGame.perspectiveColor);
        if (friendlyArmyUnits)
        {
            const distance = getDistanceToNearestUnit(thisGame, friendlyArmyUnits, piece);
            const distanceWeight = distance ? (1 - 0.1 * distance) : 1;
            score = 0.77 * distanceWeight;
        }
        const adjacentFriendlyCivCount = countAdjacentCivilizations(thisGame, piece)
        score += adjacentFriendlyCivCount ? 0.03 * adjacentFriendlyCivCount : 0;
        score += hasAdjacentEnemyTown(thisGame, piece) ? 0.07 : 0;
        if (hasEnemyFrigate && piece.findFrigate(enemyColor).hasUnloadables())
        {
            score += 0.0625;
        }
    }
    // Add small weight for other considerations.
    score += hasAdjacentBattle(thisGame, piece) ? 0.03125 : 0;
    score += hasAdjacentEnemyArmy(thisGame, piece) ? 0.03125 : 0;
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
    const enemyColor = !thisGame.perspectiveColor * 1;
    const defenderUnitCount = piece.getMilitaryUnitCount(enemyColor);
    const attackerUnitCount = piece.getMilitaryUnitCount(thisGame.perspectiveColor);
    let isOverkill = null;
    if (defenderUnitCount === 0 && (piece.hasCity(enemyColor) || piece.terrainDefenses() === 2) && attackerUnitCount > 3)
    {
        isOverkill = true;
    }
    else if (defenderUnitCount === 0 && piece.hasTown(enemyColor) && attackerUnitCount > 2)
    {
        isOverkill = true;
    }
    else if (defenderUnitCount === 1 && !piece.hasArtillery(enemyColor) && !piece.isMountain() && !piece.hasCivilization(enemyColor) && attackerUnitCount > 1)
    {
        isOverkill = true;
    }
    else
    {
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
    const enemyColor = !thisGame.perspectiveColor * 1;
    thisGame.pieces.addNeededPennants(enemyColor, enemyColor, false);
    let threat = guessArmyThreat(thisGame, piece, enemyColor);
    thisGame.pieces.removePennants(enemyColor, false);
    const enemyFrigates = findFrigates(thisGame, enemyColor);
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


function guessArmyThreat(thisGame, piece, enemyColor)
{
    let threat = {count: 0, hasInfantry: false, hasCavalry : false, hasArtillery: false};
    const enemyArmyUnits = getArmyUnits(thisGame, enemyColor);
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
    // Frigate rules:
    if (unit.isFrigate())
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
    }
    // Army units: consider guarding a beseiged town vs attacking.
    else if (unit.piece.hasCivilization(thisGame.perspectiveColor))
    {
        const isPinned = unit.piece.hasAdjacentRollingEnemy(thisGame.perspectiveColor, thisGame.player.team.rulerColor);
        if (isPinned)
        {
            // Going to own capital or from own capital to fight is always approved.
            if (destinationPiece.hasCapital(thisGame.perspectiveColor) || ( unit.piece.hasCapital(thisGame.perspectiveColor) && destinationPiece.hasRollingOpponent(thisGame.perspectiveColor)))
            {
                return true;
            }
            // Cavalry may always join battles that don't have friendly cavalry and attack unguarded towns.
            const unguarded = destinationPiece.countOpponentMilitary(thisGame.perspectiveColor) === 0;
            if (unit.type === "c" && destinationPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor && !destinationPiece.hasCavalry(thisGame.perspectiveColor)) ||
                unit.isCavalry() && destinationPiece.hasOpponentTown(thisGame.perspectiveColor) && unguarded)
            {
                return true;
            }
            // For last pinned defenders:
            const defenderCount = unit.piece.getMilitaryUnitCount(thisGame.perspectiveColor);
            if (defenderCount === 1)
            {
                const attackingToBreakSiege = (destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) && isAdjacent(thisGame, unit.piece.boardPoint, destinationPiece.boardPoint)) || window.isManeuveringToAttack === true;
                const loneEnemy = destinationPiece.countOpponentMilitary(thisGame.perspectiveColor) === 1;
                const friendlySupport = hasAdjacentSupport(thisGame, unit.piece); 
                if (attackingToBreakSiege && loneEnemy && friendlySupport)
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
            if (isVulnerable(thisGame, unit.piece) && !destinationPiece.hasRollingOpponent(thisGame.perspectiveColor))
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
    }
    // Default case: accept move.
    return true;
}


function hasAdjacentSupport(thisGame, adjacentPiece)
{
    const adjacentPieceIndices = adjacentPiece.getAdjacentIndecies(1);
    for (const adjacentPieceIndex of adjacentPieceIndices)
    {
        adjacentPiece = thisGame.pieces[adjacentPieceIndex];
        if (adjacentPiece.getMilitaryUnitCount(thisGame.perspectiveColor))
        {
            return true;
        }
    }
    return false;
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
}


function bombard(thisGame, unit, bombardablePoints)
{
    const fireDelay = 400;
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
                        setTimeout(function(){
                            thisGame.pieces[targetPiece.index].bombardOkClick(thisGame.player.team.color);
                            unit.hasBombarded = unit.noBombard = unit.movementComplete = true;
                            console.log("Bombardment!");
                            window.isBombarding = false;
                        }, reviewDelay)
                    }, applyHitsDelay);
                }, commitDelay);
            } // End if hasFired
            else
            {
                // Rare case: failure to fire indicates some abnormal interferance, so stop trying to fire.
                unit.hasBombarded = true;
                unit.noBombard = true;
                unit.movementComplete = true;
                window.isBombarding = false;
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
    hideEndTurnButtons();
    selectBattle(thisGame, battlePiece);
    ensureMovementComplete(thisGame, battlePiece);
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
                                // After battle, prevent further battles with a pennant.
                                const piece = thisGame.pieces[battlePiece.index];
                                if (piece.hasRollingOpponent(thisGame.perspectiveColor))
                                {
                                    const enemyColor = piece.units[0].color;
                                    piece.addPennantIfNeeded(enemyColor, enemyColor, true, true);
                                }
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
    }
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
    const defenderColor = (attackerColor === 0) ? 1 : 0;
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
    }, 200);
}


async function placeReserves(thisGame)
{
    clearIntervalsAndTimers();
    window.reserveIntervalId = await setInterval(placeReserveUnit, 1200, thisGame);
}


function placeReserveUnit(thisGame){
    if (window.stopKomputer === true)
    {
        stopAndReset();
        return;
    }
    if (window.hasBattleBegun)
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
        // Maybe settle explored terrain.
        if (document.getElementById("Foundation_Elemental_" + gameVersion + "_overlayCommit") &&
            !document.getElementById("Foundation_Elemental_" + gameVersion + "_endMyTurn"))
        {
            thisGame.overlayCommitOnClick();
            setTimeout(function(){
                const hexTerrain = thisGame.getMapCustomizationData();
                if (hexTerrain.length > 0)
                {
                    const waterPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_waterSwap");
                    const isEarlyGame = thisGame.maxMoveNumber < 16;
                    if (waterPopup && isEarlyGame || 
                        waterPopup && (Math.random() < 0.3))
                    {
                        thisGame.swapWaterForLand();
                        console.log("Water swap!");
                    }
                    const targetPiece = thisGame.pieces.findAtPoint(destinationBoardPoint);
                    if(targetPiece.index === 7 || targetPiece.index === 36)
                    {
                        thisGame.playOptions.mapCustomizationData = hexTerrain.split('').reverse().join('');
                    }
                    else if (hexTerrain.length > 1)
                    {
                        const newHexOrder = decideHexOrder(thisGame, hexTerrain, destinationBoardPoint);
                        thisGame.playOptions.mapCustomizationData = newHexOrder;
                    }                
                    setTimeout(function(){
                        thisGame.customizeMapDoAll(true);
                    }, 100);
                }
            }, 200);
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
    window.isKomputerReady = true;
    resetKomputerButtonStyle();
    console.log("Done.");
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
    // Default (no new terrain): choose roughly midway to front lines.
    // If default already has a town, try to reinforce a central point, then build up wings before the tail.
    const defaultPoint = buildablePoints[Math.floor(buildablePoints.length * 0.5)];
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
        if (isExactCenter)
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
        if (isPlayingRed)
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
    const topCenterPoint = thisGame.pieces[51].boardPoint;
    let townPoint = null;
    for (const reservable of reservables)
    {
        if (reservable.equals(topCenterPoint) && !thisGame.pieces[51].hasCapital(thisGame.perspectiveColor))
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
    return null;
}


function hasSmoothTerrain(thisGame, pieceIndex)
{
    return (thisGame.pieces[pieceIndex].boardValue === "p" || thisGame.pieces[pieceIndex].boardValue === "g");
}


function sortByClosestToEnemy(thisGame, points)
{
    // Get enemy armies or towns.
    const enemyColor = !thisGame.perspectiveColor * 1;
    let enemyArmies = getArmyUnits(thisGame, enemyColor);
    if (!enemyArmies)
    {
        enemyArmies = [getRandomItem(thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor)).findCivilization(enemyColor)];
        if (enemyArmies.length === 0)
        {
            return points;
        }
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
    while (piecePendingValue) {
        const landHexValue = getRandomAvailableHexValue(thisGame);
        piecePendingValue.setValue(landHexValue);
        thisGame.maybeUndarkPiece(piecePendingValue);
        logData.push(piecePendingValue.index);
        logData.push(landHexValue);
        piecePendingValue = thisGame.pieces.findByBoardValue("l");
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
        let armyUnits = getArmyUnits(thisGame, thisGame.perspectiveColor);
        if (armyUnits && armyUnits.length > 0)
        {
            counterGraveDanger(thisGame, armyUnits);
            armyUnits = getArmyUnits(thisGame, thisGame.perspectiveColor);
            counterThreats(thisGame, armyUnits);
        }
    }
}


function counterGraveDanger(thisGame, armyUnits)
{
    const usingCavalry = false;
    const recallUnits = getPrioritizedRecallUnits(thisGame, armyUnits, usingCavalry);
    for (const unit of recallUnits)
    {
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
                    thisGame.redeployUnitsMouseUp(targetScreenPoint);
                    console.log("Troops recalled for civil defense!")
                    break;
                }
            }
        }
    }
}


function counterThreats(thisGame, armyUnits)
{
    const usingCavalry = true;
    const recallUnits = getPrioritizedRecallUnits(thisGame, armyUnits, usingCavalry);
    for (const unit of recallUnits)
    {
        if ((isLoneCivDefender(thisGame, unit) || isSecondCivDefender(thisGame, unit)) && hasThreat(thisGame, unit.piece))
        {
            continue;
        }
        const reservables = thisGame.pieces.getReservables(unit.color,unit.rulerColor,unit.type,thisGame.doesColorControlTheirCapital(unit.color));
        if (reservables && reservables.length > 0)
        {
            for (let index = 0; index < reservables.length; index++)
            {
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
                    thisGame.redeployUnitsMouseUp(targetScreenPoint);
                    console.log("Troops recalled for civil defense!")
                    break;
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
        const frigates = findFrigates(thisGame, thisGame.perspectiveColor);
        if (frigates.length > 0)
        {
            for (const frigate of frigates)
            {
                // Skip any frigate with cargo, with a pin, or supporting a friendly.  
                if (frigate.hasUnloadables() || hasAdjacentEnemyTown(thisGame, frigate.piece) || 
                (hasAdjacentFriendlyCiv(thisGame, frigate.piece) && hasThreat(thisGame, findAdjacentFriendlyCiv(thisGame, frigate.piece))) ||
                hasAdjacentFriendlyArmy(thisGame, frigate.piece) && hasThreat(thisGame, findAdjacentFriendlyArmy(thisGame, frigate.piece))) 
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
                        for (let i = 0; i < reservables.length; i++)
                        {
                            // Check the ports, which are placeholder reservables, rather than the port-adjacent destinations.
                            if (reservables[i].placeHolderOnly)
                            {
                                let possiblePort = thisGame.pieces.findAtPoint(reservables[i]);
                                // A port under threat is a primary target.
                                if (hasThreat(thisGame, possiblePort))
                                {
                                    do 
                                    {
                                        // Push the valid port-adjacent reservables. 
                                        primaryTargets.push(reservables[++i]);
                                    } while (i+1 < reservables.length && !reservables[i+1].placeHolderOnly);
                                    break;
                                }
                                // A port with friendly units is a secondary target.
                                const hasFriendlies = possiblePort.units.length > 2;
                                if (hasFriendlies)
                                {
                                    do
                                    {
                                        secondaryTargets.push(reservables[++i])
                                    } while (i+1 < reservables.length && !reservables[i+1].placeHolderOnly);
                                }
                            }
                        }
                        const hasTarget = (primaryTargets.length || secondaryTargets.length) > 0;
                        if (hasTarget) 
                        {
                            // Recall the frigate.
                            const targetPoints = primaryTargets.length > 0 ? primaryTargets : secondaryTargets;
                            thisGame.reservePhaseOnMouseDown(frigate.screenPoint);
                            const targetPiece = thisGame.pieces.findAtPoint(getRandomItem(targetPoints));
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


// Highly specific instructions for the first two turns
function placeCapital(thisGame)
{
    // Maybe reset game move count, in the case a previous game was played.
    thisGame.maxMoveNumber = thisGame.maxMoveNumber < 6 ? thisGame.maxMoveNumber : 0;
    const isFirstPlayer = thisGame.perspectiveColor === 0;
    let pieceIndexStandardChoices = getCommonInitialChoices(thisGame);
    let pieceIndex = isFirstPlayer ? getFirstCapitalPieceIndex(thisGame, pieceIndexStandardChoices) : getNextCapitalPieceIndex(thisGame, pieceIndexStandardChoices);
    if (!pieceIndex)
    {
        pieceIndex = findRandomTargetPieceIndex(thisGame);
        if (!pieceIndex)
        {
            window.isKomputerReady = true;
            resetKomputerButtonStyle();
            console.log("Terrain not playable.");
            return;
        }        
    }
    let destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
    
    // Explore 5 initial hexes, handle water.
    let hexOrder = thisGame.getMapCustomizationData();
    const hasWater = (hexOrder.indexOf("w") > -1) ? true : false;
    if (hasWater)
    {
        while (terrainCount(hexOrder, "w") > 2)
        {
            thisGame.swapWaterForLand();
            hexOrder = thisGame.getMapCustomizationData();
        }
    }
    // Decide initial hex order.
    setTimeout(function(){
        thisGame.playOptions.mapCustomizationData = decideInitialHexOrder(hexOrder, pieceIndex);
        // Decide capital location.
        const shortDelay = 400;
        const longDelay = 700;
        setTimeout(function(){
            thisGame.customizeMapDoAll(true);        
            // Place capital & commit. 
            thisGame.placeCapitalMouseDown(destinationScreenPoint);
            commitExploration(thisGame);
            setTimeout(function(){
                // Maybe swap water hex for land.
                const waterPopup = document.getElementById("Foundation_Elemental_" + gameVersion + "_waterSwap");
                if (waterPopup)
                {
                    thisGame.swapWaterForLand();
                    console.log("Water swap!");
                }
                // Maybe reorder hexes explored by capital to keep a fast path to the center.
                if(pieceIndex === 7 || pieceIndex === 36)
                {
                    let hexOrder = thisGame.getMapCustomizationData();
                    thisGame.playOptions.mapCustomizationData = hexOrder.split('').reverse().join('');
                }
                setTimeout(function(){
                    thisGame.customizeMapDoAll(true);
                    // End player 1 turn.
                    if (thisGame.perspectiveColor === 0)
                    {
                        thisGame.endMyTurn();
                        window.isKomputerReady = true;
                        resetKomputerButtonStyle();
                        console.log("Done.");
                    }
                    // Player 2 places another town based on specific location data. Later reserve phases use other guidance.
                    else
                    {
                        if (thisGame.movePhase === 11)
                        {
                            let element = document.querySelector("#Foundation_Elemental_" + gameVersion + "_reserve_0");
                            thisGame.reserveOnMouseDown(null, thisGame.event("reserveOnMouseDown(this,event,#)"), 0);
                            if (getCommonInitialChoices(thisGame).includes(pieceIndex))
                            {
                                pieceIndex = (pieceIndex < 51) ? pieceIndexStandardChoices[0] : (pieceIndex > 51) ? pieceIndexStandardChoices[1]: getRandomItem(pieceIndexStandardChoices);
                            }
                            else
                            {
                                pieceIndex = findRandomTargetPieceIndex(thisGame);
                                if (!pieceIndex)
                                {
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
                        }
                    }}, longDelay);
                }, shortDelay);
        }, shortDelay);
    }, 1000)
}


function hasInvalidCapitalHexes(thisGame, pieceIndexChoices)
{
    if (pieceIndexChoices === null)
    {
        return true;
    }
    const defaultHexCount = 5;
    if (thisGame.playOptions.mapCustomizationData.length >= defaultHexCount)
    {
        return false;
    }
    for (const pieceIndex of pieceIndexChoices)
    {
        if (!thisGame.isTargetPoint(thisGame.pieces[pieceIndex].boardPoint))
        {
            return true;
        }
    }
    return false;
}


function findRandomTargetPieceIndex(thisGame)
{
    if (thisGame.targetPoints.length > 0)
    {
        validPieceIndices = [];
        for (const piece of thisGame.pieces)
        {
            if (thisGame.isTargetPoint(piece.boardPoint))
            {
                validPieceIndices.push(piece.index);
            }
        }
        return getRandomItem(validPieceIndices);
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
    const playerColor = thisGame.perspectiveColor;
    const playerCount = thisGame.numberOfDistinctPlayers;
    let smallBoardChoices = null;
    let largeBoardChoices = null;
    switch(playerColor)
    {
        case 0: 
        {
            smallBoardChoices = [7, 9, 24];
            largeBoardChoices = [9, 11, 28];
            break;
        }
        case 1:
        {
            smallBoardChoices = [36, 51, 53];
            largeBoardChoices = playerCount === 2 ? [62, 79, 81] : playerCount === 3 ? [22, 41, 62] : null;
            break;
        }
        case 2:
        {
            largeBoardChoices = [68, 83, 81];
            break;
        }
        default:
            break;
    }
    if (isSmallBoard)
    {
        return smallBoardChoices;
    }
    else if (isLargeBoard)
    {
        return largeBoardChoices;
    }
    return null;
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
        return pieceIndexChoices.splice(getRandomIndexExclusive(pieceIndexChoices.length), 1);
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
    // Take the opposite side of the enemy, or if center, play random.
    const centralIndex = isSmallBoard ? 9 : 11;
    const enemyColor = !thisGame.perspectiveColor * 1;
    if (isSmallBoard && thisGame.pieces[centralIndex].hasUnit(enemyColor, "C"))
    {
        return pieceIndexChoices.splice(getRandomIndexExclusive(pieceIndexChoices.length), 1);
    }
    const enemyCapitalPiece = thisGame.pieces.findCapitalPiece(enemyColor);
    if (enemyCapitalPiece)
    {
        if (enemyCapitalPiece.index < centralIndex)
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


function decideInitialHexOrder(hexOrder, capitalPieceIndex)
{
    // Returns new hex order string, takes hexOrder string and integer index.
    // Ensures land on the first, third, and fifth hex to maximize town growth.
    // Seeks to boost edge town support via land path between center and edge.
    // When capital is on the right, keeps possible water hexes toward the right.
    // Otherwise, keeps water hexes toward the left.
    const hasRightSideCapital = (capitalPieceIndex === 24 || capitalPieceIndex === 53);
    const waterCount = terrainCount(hexOrder, "w");
    let initialHexOrder = [];
    switch (waterCount)
    {
        case 2: 
            initialHexOrder = hasRightSideCapital ? 
                [hexOrder[1], hexOrder[3], hexOrder[0], hexOrder[4], hexOrder[2]] : 
                [hexOrder[2], hexOrder[4], hexOrder[0], hexOrder[3], hexOrder[1]] ;
            break;
        case 1:
            initialHexOrder = hasRightSideCapital ? 
                [hexOrder[2], hexOrder[0], hexOrder[1], hexOrder[4], hexOrder[3]] :
                [hexOrder[3], hexOrder[4], hexOrder[1], hexOrder[0], hexOrder[2]] ;
            break;
        default: 
            initialHexOrder = hasRightSideCapital ?
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
        const forestIndex = initialHexOrder.indexOf("f");
        const middleIndex = 2;
        swapHexOrder(initialHexOrder, forestIndex, middleIndex);
    }
    // Try to put grassland on the far side.
    if (grassCount > 0)
    {
        const grassIndex = initialHexOrder.indexOf("g");
        const farSideIndex = hasRightSideCapital ? 0 : 4;
        swapHexOrder(initialHexOrder, grassIndex, farSideIndex);
    }
    return initialHexOrder.join("");
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


function decideHexOrder(thisGame, hexTerrain, unitOrigin)
{
    let newOrder = [];
    const waterCount = terrainCount(hexTerrain, "w");

    // Find all hex terrain piece indices.
    let hexTerrainPieceIndices = [];
    let hexIndex = thisGame.boardVisibility.indexOf("1");
    if (hexIndex < 0) 
    {
        return "";
    }
    hexTerrainPieceIndices.push(hexIndex);
    while (hexTerrainPieceIndices.length < hexTerrain.length) 
    {
        hexIndex = thisGame.boardVisibility.indexOf("1", hexIndex + 1);
        hexTerrainPieceIndices.push(hexIndex);
    }

    // After first turn, measure how close each hex is to facing the enemy. 
    if (thisGame.maxMoveNumber > 8)
    {
        // For each hex index, find the angle of vectors, from unit to enemy and from unit to hex.
        // Find an enemy point (top / bottom center) and draw a vector to it from the unit origin.
        // Then draw a second vector to the hex and measure the angle.
        const enemyColorIsYellow = !thisGame.perspectiveColor;
        const enemyPieceIndex = enemyColorIsYellow ? 51 : 9;
        const enemyPoint = thisGame.pieces[enemyPieceIndex].boardPoint.clone();
        const vectorToEnemy = enemyPoint.subtract(unitOrigin);
        const vectorToEnemyWorldAngle = Math.atan2(vectorToEnemy.y, vectorToEnemy.x);
        let angleFromEnemyToHexes = [];
        for (let index = 0; index < hexTerrainPieceIndices.length; index++) {
            const hexPoint = thisGame.pieces[hexTerrainPieceIndices[index]].boardPoint.clone();
            const vectorToHex = hexPoint.subtract(unitOrigin);
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
        while (hexTerrains.length > 0) {
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
        }
    }
    // First turn case, for Red only:
    else
    {
        newOrder = hexTerrain.split('');
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
    }
    return newOrder.join("");
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


function hasAdjacentAccessibleInlandSea(thisGame, piece, unit)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.boardValue === "w" && isAccessibleNow(adjacentPiece, unit)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.boardValue === "w" && isAccessibleNow(adjacentPiece, unit)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.boardValue === "w" && isAccessibleNow(adjacentPiece, unit)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.boardValue === "w" && isAccessibleNow(adjacentPiece, unit)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.boardValue === "w" && isAccessibleNow(adjacentPiece, unit)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.boardValue === "w" && isAccessibleNow(adjacentPiece, unit));
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


function isAccessibleNow(piece, unit, viaImaginaryCargo)
{
    if (piece && unit)
    {
        let unitMovablePoints = [];
        if (unit.isFrigate() && viaImaginaryCargo)
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
        if (unitMovablePoints.length)
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


function hasAdjacentEnemyArmy(thisGame, piece)
{
    const enemyColor = !thisGame.perspectiveColor * 1;
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, enemyColor));
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


function getArmyUnits(thisGame, color)
{
    let armies = [];
    for (const piece of thisGame.pieces)
    {
        // Skip water and reserve pieces
        if (piece.isWater() || piece.valueIndex === - 1)
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (unit.color === color && unit.isMilitary())
            {
                armies.push(unit);
            }
        }
    }
    return (armies.length > 0 ? armies : null );
}


function getRandomItem(items)
{
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
                const invasionOrigin = findAdjacentAmphibiousInvasionOrigin(thisGame, targetPiece);
                const originTargetPoint = thisGame.targetPoints[thisGame.findTargetPoint(invasionOrigin.boardPoint)]; 
                movingPiece.movingUnit.moveTo(invasionOrigin, originTargetPoint.spacesNeeded, originTargetPoint.retreatIndex);
                oldPiece.updateUnitDisplay();
                invasionOrigin.updateUnitDisplay();
            }
            // Select last cargo.
            movingPiece.movingUnit.activeCargoIndex = (movingPiece.movingUnit.cargo.length - 1);
            // Todo: if logging, ensure log has all moves.
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


function findAdjacentAmphibiousInvasionOrigin(thisGame, landPiece)
{
    const color = thisGame.perspectiveColor;
    var waterPiece;
    return ((waterPiece=landPiece.pieces.findAtXY(landPiece.boardPoint.x-1,landPiece.boardPoint.y))!=null && isAmphibiousCapable(thisGame, waterPiece, color)) ||
            ((waterPiece=landPiece.pieces.findAtXY(landPiece.boardPoint.x+1,landPiece.boardPoint.y))!=null && isAmphibiousCapable(thisGame, waterPiece, color)) ||
            ((waterPiece=landPiece.pieces.findAtXY(landPiece.boardPoint.x,landPiece.boardPoint.y-1))!=null && isAmphibiousCapable(thisGame, waterPiece, color)) ||
            ((waterPiece=landPiece.pieces.findAtXY(landPiece.boardPoint.x,landPiece.boardPoint.y+1))!=null && isAmphibiousCapable(thisGame, waterPiece, color)) ||
            ((waterPiece=landPiece.pieces.findAtXY(landPiece.boardPoint.x-1,landPiece.boardPoint.y-1))!=null && isAmphibiousCapable(thisGame, waterPiece, color)) ||
            ((waterPiece=landPiece.pieces.findAtXY(landPiece.boardPoint.x+1,landPiece.boardPoint.y+1))!=null && isAmphibiousCapable(thisGame, waterPiece, color)) ? waterPiece : null;
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


function patchGamePrototype()
{
    GamesByEmail.Viktory2Game.prototype.redeployUnitsMouseUp = function(screenPoint)
    {
        this.onMouseMove=null;
        this.onLeftMouseUp=null;
        var boardPoint=this.boardPointFromScreenPoint(this.constrainPoint(screenPoint));
        var movingPiece=this.pieces.getNewPiece();
        if (!boardPoint || !movingPiece)
        {
            return;
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
	toggleStyle = toggle.style;
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


function resetAllButtonStyles()
{
    resetKomputerButtonStyle();
    resetStopKomputerButtonStyle();
    resetButtonPositions();
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


function resetButtonPositions()
{
    let runButton = document.getElementById("KomputerButton");
    runButton.style.top = getRunButtonTop();
    let stopButton = document.getElementById("StopKomputerButton");
    stopButton.style.top = getStopButtonTop();
    let darkModeToggle = document.getElementById("DarkModeToggle");
    darkModeToggle.style.top = getDarkModeToggleTop();
    let darkModeLabel = document.getElementById("DarkModeLabel");
    darkModeLabel.style.top = getDarkModeToggleLabelTop();
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
    if (thisGame.previewing)
    {
        const boardBuilderDiv = document.createElement('div');
        boardBuilderDiv.style.display = 'flex';
        boardBuilderDiv.style.flexDirection = 'column';
        boardBuilderDiv.style.position = "absolute";
        boardBuilderDiv.style.top = getBoardBuilderTop();
        boardBuilderDiv.style.left = getBoardBuilderLeft();
        boardBuilderDiv.style.fontSize = "10px";
        boardBuilderDiv.style.fontFamily = "Verdana";
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
            const radioButtons = createRadioButton(option.value);
            boardBuilderDiv.appendChild(radioButtons);
        });
        addBoardBuilderToggle();
    }
}


function createRadioButton(value, groupName = 'RadioGroup') {
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
    addTerrainInputListener(radioButton);
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
    const playerNotesOffset = 144;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset + 'px');
}


function getBoardBuilderLeft()
{
    const playerNotesOffset = 28;
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
	toggleStyle = toggle.style;
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
    const boardBuilderTop = 142;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + boardBuilderTop + 'px');
}


function getBoardBuilderToggleLeft()
{
    const boardBuilderLeft = 100;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.3;
    return (window.scrollX + playerNotesMidwayX + boardBuilderLeft + 'px');
}


function getBoardBuilderToggleLabelTop()
{
    const boardBuilderTop = 147;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + gameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + boardBuilderTop + 'px');
}


function getBoardBuilderToggleLabelLeft()
{
    const boardBuilderLeft = 120;
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
        maybeSelectRadioButton();
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
    maybeSelectRadioButton();
    const xOffset = document.getElementById("Foundation_Elemental_" + gameVersion + "_pieces").getBoundingClientRect().left + window.scrollX; // 20
    const yOffset = document.getElementById("Foundation_Elemental_" + gameVersion + "_pieces").getBoundingClientRect().top + window.scrollY; // 300
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


function maybeSelectRadioButton()
{
    for (const terrain in window.isTerrainSelected)
    {
        if (window.isTerrainSelected[terrain] === true)
        {
            return;
        }
    }        
    let radioButton = document.getElementById("RadioGroupPlains");
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
    const toggle = document.getElementById("BoardBuilderToggle");
    if (toggle && !toggle.checked)
    {
        toggle.checked = true;
        boardBuilderToggleMouseClick(null, toggle);
    }
}

