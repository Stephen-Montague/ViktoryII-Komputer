/* 
    Viktory II Komputer 
    Add computer opponents, gameplay sound, and enhancements for Viktory II on GamesByEmail. 
    By Stephen Montague 
    stephen.montague.viktory@gmail.com 
*/

/* ESLint */
/* global GamesByEmail, Foundation, GameVersion, KomputerSound:writable */

// Begin Main 
komputerLog("Hello Viktory.");
setupExtensionBase();


function setupExtensionBase(force = false)
{
    if (!window.komputerLocations || force)
    {
        window.komputerLocations = [];
    }
    if (isLocationNew())
    {
        window.komputerLocations.push(window.location.href);
        const intervalId = setInterval(function()
        {
            if (hasGameFoundation())
            {
                if (setupGameExtension())
                {
                    clearInterval(intervalId);
                    window.isKomputerReady = true;
                }
            }
        }, 800);
    }
}


function hasGameFoundation()
{
    if (typeof(GamesByEmail) === "undefined" || !GamesByEmail || 
        !GamesByEmail.findFirstGame || !GamesByEmail.GAME_TYPE)
    {
        return false;
    }
    const game = GamesByEmail.findFirstGame();
    return (game && (game.type === GamesByEmail.GAME_TYPE.VIKTORY2)) ? true : false;
}


function setupGameExtension()
{
    let thisGame = findGameForActiveTab();  
    const hasElementalIds = verifyElementalIds(thisGame); 
    if (!hasElementalIds)
    {
        return false;
    }
    if (isGameReady(thisGame))
    {
        patchControls();
        addTouchSupport();
        patchGamePrototype();
        patchPiecePrototype();
        patchUnitPrototype();
        if (!document.getElementById("KomputerButton_" + GameVersion))
        {
            styleGameMessageBox(thisGame);
            addRunButton("Let Komputer Play", runKomputerClick, thisGame);
            addStopButton("Stop", stopKomputerClick);
            addDarkModeToggle();
            addBoardBuilder(thisGame);
            addLocalMultiplayer(thisGame);
            addSound(thisGame);
            cacheElementsForStyling();
        }
        window.onerror = function() 
        {
            console.warn("Caught error. Will reset controls.");
            stopAndReset(true);
        }
        return true;
    }
    return false;
}


function findGameForActiveTab()
{
    let activeGame = GamesByEmail.findFirstGame();
    if (!activeGame)
    {
        return null;
    }
    if (!hasGamesByEmailTabs())
    {
        return activeGame;
    }
    const tabs = GamesByEmail.Controls.StartGameTabSet.getFirst(true).tabs;
    if (activeGame.previewing)
    {
        for (const tab of tabs)
        {
            if (tab.id === "Preview" && tab.isInFront)
            {
                return activeGame;
            }
        }
    }
    let lastActiveGame = null;
    while (activeGame)
    {
        for (const tab of tabs)
        {
            const tabNumber = tab.id * 1;
            const gameNumber = activeGame._playerId;
            if (tab.isInFront && tabNumber === gameNumber)
            {
                return activeGame;
            }
        }
        lastActiveGame = activeGame;
        activeGame = GamesByEmail.Game.getNext(activeGame, true);
    }
    return lastActiveGame;
}


function hasGamesByEmailTabs()
{
    return (GamesByEmail && GamesByEmail.Controls && GamesByEmail.Controls.StartGameTabSet);
}


function verifyElementalIds(thisGame)
{
    if (!thisGame)
    {
        return false;
    }
    window.GameVersion = thisGame.$Foundation_$registry_index;
    if (document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles'))
    {
        return true;
    }
    window.GameVersion = null;
    return false;
}


function isGameReady(thisGame)
{
    return (thisGame && GameVersion && typeof(thisGame.movePhase) === "number" &&
        document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles'));
}


// Begin Play
function runKomputerClick(thisGame)
{
    if (window.isKomputerReady)
    {
        if (thisGame.previewing || thisGame.player.isMyTurn())
        {
            clearLastAction(thisGame);
            patchPieceData(thisGame);
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


function clearMoveIntervals()
{
    for (const intervalId of window.moveIntervalIds)
    {
        clearInterval(intervalId);
    }
}

function clearReserveIntervals()
{
    for (const intervalId of window.reserveIntervalIds)
    {
        clearInterval(intervalId);
    }
}


function clearIntervalsAndTimers(thisGame)
{
    if (!thisGame)
    {
        thisGame = findGameForActiveTab();  
    }
    const flashList = thisGame ? thisGame.pieces.flashList : null;
    const saveIds = thisGame ? [] : null;
    if (flashList && flashList.constructor === Array)
    {
        for (const flash of flashList)
        {
            if (flash)
            {
                saveIds.push(flash.timerHandle);
            }
        }    
    }
    for (var i = setTimeout(function() {}, 0); i > 0; i--) 
    {
        if (saveIds && saveIds.includes(i))
        {
            continue;
        }
        window.clearInterval(i);
        window.clearTimeout(i);
    }
}


function resetGlobals(resetKomputerButton = false)
{
    const thisGame = findGameForActiveTab();
    verifyElementalIds(thisGame);
    window.currentPlayerTurn = thisGame.perspectiveColor;
    window.isSmallBoard = thisGame.pieces.length === 62;
    window.isLargeBoard = !window.isSmallBoard;
    window.isWorldExplored = markIsWorldExplored(thisGame);
    window.moveIntervalIds = [];
    window.reserveIntervalIds = [];
    window.flashIds = [];
    window.flashIndex = 0;
    window.holdingUnits = [];
    window.doHoldingWave = true;
    window.enemyTargets = [];
    window.primaryTargetColors = null;
    window.moveWave = 0;
    window.movingUnitIndex = 0;
    window.waitCount = 0;
    window.lastMovedUnit = null;
    window.movingToAttackIndex = null;
    window.movingToAttackOrigin = null;
    window.hasBattleBegun = false;
    window.isBombarding = false;
    window.isExploring = false;
    window.isManeuveringToAttack = false;
    window.isMoving = false;
    window.isUnloading = false;
    window.stopKomputer = false;
    window.isKomputerReady = false;
    if (resetKomputerButton)
    {
        resetKomputerButtonStyle(false);
        window.isKomputerReady = true;
    }
    if (KomputerSound)
    {
        KomputerSound.bellsPlayedThisTurn = false;
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
    setTimeout(function(){ handleCurrentState(thisGame) }, 100);
}


function handleCurrentState(thisGame)
{
    komputerLog("Checking state.");
    switch(thisGame.movePhase)
    {
        case 0:
            komputerLog("Game won.");
            handleWinState(thisGame);
            break;
        case 2:
            komputerLog("Placing capital.");
            placeCapital(thisGame);
            break;
        case 5:
            komputerLog("Movement Wave: " + window.moveWave);
            moveUnits(thisGame);
            break;
        case 6:
            komputerLog("Retreat is not an option. Returning to battle.");
            thisGame.movePhase = 5;
            thisGame.update();
            break;
        case 11:
            komputerLog("Placing reserves.");
            placeReserves(thisGame);
            break;
        default:
            console.warn("Unhandled movePhase: " + thisGame.movePhase);
            stopAndReset();
            break;
    }
}


// If the human began to explore or fight, clear this first.
function clearLastAction(thisGame)
{
    let activeExploration = thisGame.playOptions.mapCustomizationData;
    const isNotCapitalMovePhase = thisGame.movePhase !== 2;
    if (isNotCapitalMovePhase && activeExploration.length > 0)
    {
        thisGame.playOptions.mapCustomizationData = shuffle(activeExploration);
        thisGame.customizeMapDoAll(true);
    }
    let overlayCommit = document.getElementById("Foundation_Elemental_" + GameVersion + "_overlayCommit");
    if (overlayCommit && overlayCommit.value === "Roll for Battle")
    {
        thisGame.undo();
    }
}


function handleWinState(thisGame)
{
    playSound("win");
    setTimeout(function(){
        thisGame.maxMoveNumber = 0;
        window.isKomputerReady = true;
        resetKomputerButtonStyle(true);
    }, 1200);
}


function moveUnits(thisGame)
{
    const moveIntervalPeriod = 1300;
    const initialDelay = 100;
    setTimeout(function(){
        switch (window.moveWave)
        {
            case 0: {
                komputerLog("May move land units.");
                let landUnits = findAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                const fromFarthest = true;
                orderByDistanceToEnemy(thisGame, landUnits, fromFarthest);
                prepareNextUnit(landUnits);
                moveEachUnit(thisGame, landUnits, moveIntervalPeriod);
                break;
            }
            case 1: {
                komputerLog("May move frigates.");
                const frigates = findFrigates(thisGame, [thisGame.perspectiveColor]);
                prepareNextUnit(frigates);
                moveEachUnit(thisGame, frigates, moveIntervalPeriod);
                break;
            }
            case 2: {
                komputerLog("May move all available.");
                let army = findAvailableLandUnits(thisGame, thisGame.perspectiveColor).concat(window.holdingUnits);
                const navy = findFrigates(thisGame, [thisGame.perspectiveColor]);
                const armyNavy = army.concat(navy);
                prepareNextUnit(armyNavy);
                moveEachUnit(thisGame, armyNavy, moveIntervalPeriod);
                break;
            }
            case 3: {
                handleBattles(thisGame);
                break;
            }
            case 4: {
                handleHoldingUnits(thisGame, moveIntervalPeriod);
                break;
            }
            case 5: {
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


function markIsWorldExplored(thisGame)
{
    let isExplored = true; 
    for (const piece of thisGame.pieces)
    {
        const reserveIndex = thisGame.pieces.length - 1;
        if (piece.index === reserveIndex)
        {
            continue;
        }
        if (piece.hidden === true)
        {
            isExplored = false;
            break;
        }
    }
    return isExplored;
}


function findAvailableLandUnits(thisGame, color)
{
    let landUnits = [];
    for (const piece of thisGame.pieces)
    {
        const isReservePiece = piece.valueIndex === - 1;
        if (isReservePiece)
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


function orderByDistanceToEnemy(thisGame, units, fromFarthest = true)
{
    // Skip to improve performance on large boards.
    if (thisGame.numberOfDistinctPlayers > 3 || units.length > 16)
    {
        return;
    }
    const enemyColors = getEnemyColors(thisGame);
    let enemyArmies = getArmyUnits(thisGame, enemyColors);
    if (!enemyArmies || enemyArmies.length > 16)
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
    if (fromFarthest)
    {
        units.sort(function(a, b){ return b.minDistanceToEnemy - a.minDistanceToEnemy });
    }
    else
    {
        units.sort(function(a, b){ return a.minDistanceToEnemy - b.minDistanceToEnemy });
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


function prepareNextUnit(unitList)
{
    // If the last moved unit is in the list but not first, swap it to first.
    const lastMovedUnit = window.lastMovedUnit;
    if (!unitList || unitList.length === 0 || !lastMovedUnit)
    {
        return;
    }
    if (lastMovedUnit.movementComplete || lastMovedUnit.piece.hasEnemy(lastMovedUnit.color, lastMovedUnit.rulerColor) || !lastMovedUnit.piece)
    {
        window.lastMovedUnit = null;
        return;
    }
    window.movingUnitIndex = 0;
    const firstUnit = unitList[window.movingUnitIndex];
    if (firstUnit.index === lastMovedUnit.index && firstUnit.type === lastMovedUnit.type && firstUnit.piece.index === lastMovedUnit.piece.index)
    {
        return;
    }
    let nextUnitIndex = null;
    for (let i = 0; i < unitList.length; i++)
    {
        const unit = unitList[i]
        if (unit.index === lastMovedUnit.index && unit.type === lastMovedUnit.type && unit.piece.index === lastMovedUnit.piece.index)
        {
            nextUnitIndex = i;
            break;
        }
    }
    if (nextUnitIndex)
    {
        unitList[0] = unitList[nextUnitIndex];
        unitList[nextUnitIndex] = firstUnit;
    }
    else
    {
        window.lastMovedUnit = null;
    }
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


function handleBattles(thisGame)
{
    if (thisGame.hasBattlesPending)
    {
        let battlePiece = findNextBattle(thisGame);
        if (battlePiece)
        {
            const adjacentFrigateBattle = findAdjacentFrigateBattle(thisGame, battlePiece);
            if (adjacentFrigateBattle)
            {
                battlePiece = adjacentFrigateBattle;
            }
            komputerLog("Fighting battle.");
            fightBattle(thisGame, battlePiece);
        }
        else
        {
            console.warn("Game reports a battle pending but none found.")
            stopAndReset(true);
        }
    }
    else
    {
        window.moveWave++;
        runKomputer(thisGame);
    }
}


function handleHoldingUnits(thisGame, moveIntervalPeriod)
{
    if (window.doHoldingWave)
    {
        window.doHoldingWave = false;
        const stragglers = findAvailableLandUnits(thisGame, thisGame.perspectiveColor);
        const holdingUnits = window.holdingUnits.length ? stragglers.concat(window.holdingUnits) : stragglers.concat(findHoldingUnits(thisGame));
        if (holdingUnits.length)
        {
            const isHoldingWave = true;
            prepareNextUnit(holdingUnits);
            moveEachUnit(thisGame, holdingUnits, moveIntervalPeriod, isHoldingWave);
        }
        else
        {
            window.moveWave++;
            runKomputer(thisGame);
        }
    }
    else 
    {
        handleBattles(thisGame);
    }
}


function findHoldingUnits(thisGame)
{
    let holdingUnits = [];
    for (const piece of thisGame.pieces)
    {
        const isReservePiece = piece.valueIndex === - 1;
        if (isReservePiece)
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (unit.holding)
            {
                holdingUnits.push(unit);
            }
        }
    }
    return holdingUnits;
}


function endMovementPhase(thisGame)
{
    clearMoveIntervals();
    clearHoldingUnits();
    setTimeout(function()
    {
        if (thisGame.hasBattlesPending)
        {
            handleBattles(thisGame);
            return;
        }
        komputerLog("Ending movement.");
        thisGame.endMyMovement();
        setTimeout(function()
        {
            if (thisGame.movePhase === 11)
            {
                runKomputer(thisGame);
            }
            else if(window.currentPlayerTurn !== thisGame.perspectiveColor)
            {
                resetKomputerButtonStyle();
                window.isKomputerReady = true;
                komputerLog("Done.");
            }
            else
            {    
                if (window.waitCount > 0)
                {
                    console.warn("Cannot end movement phase.");
                    stopAndReset(true);
                    return;
                }
                window.waitCount++;
                window.moveWave--;
                // There may be an alert, so wait for user to clear.
                setTimeout(function(){ runKomputer(thisGame)}, 4000);
            }
        }, 100);
    }, 100);
}


async function moveEachUnit(thisGame, movableUnits, intervalPeriod, isHoldingWave = false)
{
    window.moveIntervalIds.push(setInterval(async function moveUnitInterval()
    {
        if (window.stopKomputer === true)
        {
            stopAndReset();
            return;
        }
        if (window.hasBattleBegun || window.isMoving || window.isBombarding || window.isExploring)
        {
            return;
        }
        window.isMoving = true;
        if (!isHoldingWave && fightPreMoveBattles(thisGame))
        {
            return;
        }
        // Get the next unit and decide if it may move.
        const nextUnitIndex = getNextUnitIndex(thisGame, movableUnits);
        const isClickable = ensureIsClickable(thisGame, movableUnits, nextUnitIndex);
        const unit = movableUnits[nextUnitIndex];
        const firstMainWave = 0;
        const finalMainWave = 2;
        let possibleMoves = null;
        let shouldAcceptMove = null;
        let isUnitSelected = null;
        const mayMove = decideMayMove(thisGame, unit, firstMainWave, finalMainWave, isClickable);
        if (mayMove)
        {
            possibleMoves = unit.isFrigate() ? getFrigateMovables(unit) : getKomputerMovables(unit); 
            if (possibleMoves)
            {
                // Decide best move, or don't accept any to stay.
                const favorOffense = shouldFavorOffense(thisGame, firstMainWave, movableUnits.length);
                const bestMove = await decideBestMove(thisGame, possibleMoves, unit, favorOffense);
                const pieceIndex = bestMove.index;
                shouldAcceptMove = await decideMoveAcceptance(thisGame, unit, pieceIndex, isHoldingWave);
                komputerLog(shouldAcceptMove);
                if (shouldAcceptMove)
                {
                    isUnitSelected = moveUnitSimulateMouseDown(thisGame, unit.screenPoint, unit.type);
                    if (isUnitSelected)
                    {
                        const bufferTime = handleMoveTrail(thisGame, unit, possibleMoves, bestMove);
                        const transitTime = 100 + bufferTime;
                        if (transitTime > 100)
                        {
                            playSound("move_" + unit.type);
                        }
                        setTimeout(function()
                        {
                            // Move unit.
                            const destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                            const processMouseDownUpdateTime = 200;
                            setTimeout(function()
                            {
                                unit.setVisibility(true); 
                                moveUnitSimulateMouseUp(thisGame, destinationScreenPoint);
                                if (transitTime === 100)
                                {
                                    playSound("move_" + unit.type);
                                }
                                hideEndTurnButtons();
                                // Commit to explore.
                                const normalPopup = document.getElementById("Foundation_Elemental_" + GameVersion + "_overlayCommit");
                                if ((normalPopup || document.getElementById("Foundation_Elemental_" + GameVersion + "_customizeMapDoAll")) &&
                                    !document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyTurn"))
                                {
                                    window.isExploring = true;
                                    window.doHoldingWave = true;
                                    window.isMoving = false;
                                    window.movingUnitIndex = 0;
                                    clearMoveIntervals();
                                    if (normalPopup)
                                    {
                                        thisGame.overlayCommitOnClick();
                                    }
                                    setTimeout(function(){
                                        settleExploredTerrain(thisGame, unit);
                                    }, 128);
                                }
                                decideFrigateFlags(thisGame, unit, finalMainWave, pieceIndex);
                            }, processMouseDownUpdateTime);
                        }, transitTime);
                    }
                    // Rare: fails to select.
                    else
                    {
                        komputerLog("Failed to select unit for move. Logging unit.");
                        console.log(unit);
                        clearMovementFlags();
                        window.lastMovedUnit = null;
                    }   
                } // End if shouldAcceptMove
            } // End if possibleMoves
        } // End if may move
        const processMoveUpdateTime = mayMove && possibleMoves && shouldAcceptMove && isUnitSelected ? intervalPeriod - 200 : 200;
        setTimeout(function(){ 
            // Ideally, the next decision is made before the next interval and allows time to process the previous.
            // In any case, it should make the right decision - worst case, it waits for the next interval.
            decideHowToContinueMove(thisGame, movableUnits, unit, finalMainWave);}, processMoveUpdateTime);
    }, intervalPeriod));
}


async function rankEnemyTargets(thisGame)
{
    let targets = thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor);    
    for (const target of targets)
    {
        const threat = await guessThreat(thisGame, target, [thisGame.perspectiveColor]);
        const defense = guessDefensivePower(thisGame, target, target.getOpponentColor(thisGame.perspectiveColor));
        target.attackAdvantage = threat - defense;
    }
    targets.sort(function(a, b)
    {
        return b.attackAdvantage - a.attackAdvantage;  
    });
    window.enemyTargets = targets;
}


function fightPreMoveBattles(thisGame)
{
    if (thisGame.hasBattlesPending)
    {
        playSound("battlePending");
        for (let piece of thisGame.pieces)
        {
            if (piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
            {
                if (!KomputerSound.bellsPlayedThisTurn && piece.hasOpponentCivilization(thisGame.perspectiveColor))
                {
                    playSound("battleCiv");
                    KomputerSound.bellsPlayedThisTurn = true;
                }
                if (window.isUnloading || isNotOverkill(thisGame, piece))
                {
                    continue;
                }
                const frigateBattle = findAdjacentFrigateBattle(thisGame, piece);
                if (frigateBattle)
                {
                    piece = frigateBattle;
                }
                komputerLog("Blitz attack!");
                clearMovementFlags();
                fightBattle(thisGame, piece);
                return true;
            }
        }
    }
    return false;
}


function clearMovementFlags()
{
    window.isMoving = false;
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
    let nextUnitIndex = window.movingUnitIndex < movableUnits.length ? window.movingUnitIndex : 0;
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
    // If there's another movable unit of the same type and status in front, insert the other unit at the next unit index. 
    let movableUnit = movableUnits[nextUnitIndex];
    if (isNotValidUnit(thisGame, movableUnit))
    {
        return false;
    }
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
    const isLikelyHelpful = (thisGame.maxMoveNumber > 25) && (movingUnitsLength > 2) && (window.movingUnitIndex < (movingUnitsLength * 0.4));
    return (isLikelyHelpful && window.moveWave === firstMoveWave)
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
        if (unit.isFrigate() && !unit.hasUnloadables() && window.moveWave >= finalMoveWave)
        {
            unit.movementComplete = true;
            return false;
        }
        if(window.moveWave > firstMoveWave)
        {
            return true;
        }
        // Hold back artillery and cavalry who don't initially have an adjacent frigate.
        // By generally not moving on the first wave, they better support any battles started by infantry.
        if (unit.isCavalry() || unit.isArtillery())
        {
            if (unit.spacesMoved === 0 && !hasAdjacentFrigate(thisGame, unit.piece))
            {
                return false;
            }
        }
    }
    if (unit.isFrigate() && !unit.hasUnloadables())
    {
        window.isUnloading = false;
    }
    return true;
}


function isNotValidUnit(thisGame, unit)
{
    return (!unit || !unit.piece || !thisGame.pieces[unit.piece.index].units[unit.index]); 
}


function komputerLog(data)
{
    if (!window.hasKomputerLog)
    {
        return;
    }
    if (data === true)
    {
        console.log("Move approved.");
    }
    else if (data)
    {
        if (typeof(data) === "string")
        {
            console.log(data);
        }
        else
        {
            const thisGame = data.game;
            const unit = data.unit;
            const bestMoveScore = data.score.toFixed(2);
            const bestMoveIndex = data.bestMoveIndex;
            const color = GamesByEmail.Viktory2Game.resourcePack.teamTitles[thisGame.perspectiveColor];
            const unitName = GamesByEmail.Viktory2Game.resourcePack["unitName_" + unit.type];
            const originTerrainKey = unit.piece.isWater() ? "w" : unit.piece.boardValue;
            const originTerrain = GamesByEmail.Viktory2Game.resourcePack.logHexDescriptions[originTerrainKey];
            const destinationPiece = thisGame.pieces[bestMoveIndex];
            const destinationTerrainKey = destinationPiece.isWater() ? "w" : destinationPiece.boardValue;
            const destinationTerrain = GamesByEmail.Viktory2Game.resourcePack.logHexDescriptions[destinationTerrainKey];
            const moveOrigin = color + " " + unitName + " on the " + originTerrain + " of hex " + unit.piece.index;
            const moveScore = " has a best move score of " + bestMoveScore; 
            const moveDestination = " on the " + destinationTerrain + " of hex " + bestMoveIndex + ".";
            console.log(moveOrigin + moveScore + moveDestination);
        }
    }
    else
    {
        console.log("Move rejected.");
    }
}


function settleExploredTerrain(thisGame, unit)
{
    komputerLog("Unit exploring.");
    const waterPopup = document.getElementById("Foundation_Elemental_" + GameVersion + "_waterSwap");
    if (waterPopup)
    {
        thisGame.swapWaterForLand();
        komputerLog("Water swap!");
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
        setTimeout(function()
        {   
            ensureValidBoard(thisGame);
            window.isExploring = false;                
            setTimeout(function(){ runKomputer(thisGame) }, 100)
        }, 200);
    }, 600);
}


function handleMoveTrail(thisGame, unit, possibleMoves, movePoint)
{
    unit.setHilite(true);
    let bufferTime = 0;
    if (movePoint.spacesNeeded < 2)
    {
        return bufferTime;
    }
    // Get move trail.
    let trailPoints = [];
    let priorPoint = movePoint.clone();
    priorPoint.retreatIndex = movePoint.retreatIndex;
    let runCount = 0;
    const failsafe = 4;
    do 
    {
        for (const possibleMove of possibleMoves)
        {
            if (priorPoint.retreatIndex === possibleMove.index)
            {
                priorPoint = possibleMove;
                trailPoints.unshift(priorPoint); 
                break;
            }
        }
        runCount++;
    } while (unit.isFrigate() && priorPoint.retreatIndex !== unit.piece.index && runCount < failsafe)
    // Frigates flash trailing water.
    window.flashIndex = 0;
    if (unit.isFrigate())
    {
        window.flashIds.push(setInterval(function()
        { 
            if (window.flashIndex < trailPoints.length)
            {
                thisGame.pieces.flash(1, null, trailPoints[window.flashIndex]);
                window.flashIndex++;
            }
            else
            {
                for (const Id of window.flashIds)
                {
                    clearInterval(Id);
                }
                window.flashIndex = 0;
            }
        }, 200));
    }
    // Land units transit slowly. 
    else
    {
        bufferTime = 600;
        setTimeout(function()
        {
            if (trailPoints.length)
            {
                unit.setVisibility(false); 
                const transitPoint = trailPoints[0];
                const transitPiece = thisGame.pieces[transitPoint.index];
                const transitUnit = transitPiece.addUnit(thisGame.perspectiveColor, unit.type);
                transitUnit.movementComplete = false;
                transitPiece.updateUnitDisplay();
                setTimeout(function()
                {
                    transitPiece.removeUnit(transitUnit);
                    transitPiece.updateUnitDisplay();
                }, 712);
            }
        }, 128);
    }
    exploreDuringTransit(thisGame, trailPoints);
    return bufferTime;
}


function exploreDuringTransit(thisGame, trailPoints)
{
    for (const point of trailPoints)
    {
        const boardInfo = thisGame.info.board.split("\n");
        const boardValueData = boardInfo[1];
        const boardVisibilityList = boardInfo[2].split("");
        const transitPiece = thisGame.pieces[point.index];
        const adjacentIndecies = transitPiece.getAdjacentIndecies(1);
        const hidden = false;
        let mapCustomizations = [];
        let indeciesToReveal = [];
        for (const adjacentIndex of adjacentIndecies)
        {
            const adjacentPiece = thisGame.pieces[adjacentIndex];
            if (adjacentPiece.hidden)
            {
                adjacentPiece.setValue("l");
                adjacentPiece.setVisibility(hidden);
                const charToReveal = boardValueData.charAt(adjacentIndex);
                mapCustomizations.push(charToReveal);
                indeciesToReveal.push(adjacentIndex);
                boardVisibilityList[adjacentIndex] = "2";
            }
        }
        if (mapCustomizations.length)
        {
            thisGame.playOptions.mapCustomizationData = mapCustomizations.join('');
            thisGame.customizeMapDoAll();
            thisGame.boardVisibility = boardVisibilityList.join("");
            setTimeout(function()
            {
                for (const index of indeciesToReveal)
                {
                    thisGame.pieces[index].setVisibility(hidden);
                }
            }, 400);
        }
    }
}


function decideFrigateFlags(thisGame, unit, finalMoveWave, pieceIndex)
{
    if (unit.isFrigate())
    {
        const isFinalWave = window.moveWave >= finalMoveWave;
        if (isFinalWave && unit.hasUnloadables() && thisGame.pieces[pieceIndex].isLand())
        {
            window.isUnloading = true;
        }
        else if (unit.spacesMoved > 0 && !unit.hasUnloadables())
        {
            unit.movementComplete = true;
        }
    }
    else
    {
        window.isUnloading = false
    }
}


function decideHowToContinueMove(thisGame, movableUnits, unit, finalMoveWave)
{
    hideEndTurnButtons();
    window.isMoving = false;
    window.isManeuveringToAttack = (window.isManeuveringToAttack && !unit.movementComplete && !unit.holding) ? true : false;
    if (window.isExploring || window.isBombarding || window.isUnloading || window.isManeuveringToAttack || window.hasBattleBegun)
    {
        // Wait for above to finish.
        return;  
    }
    if (shouldBombard(thisGame, unit, finalMoveWave))
    {
        window.isBombarding = true;
        window.lastMovedUnit = null;
        window.movingUnitIndex = 0;
        window.isManeuveringToAttack = false; 
        unit.movementComplete = true;
        unit.holding = false;
        clearMoveIntervals();
        bombard(thisGame, unit, unit.getBombardables());
        return;
    }
    // If more units, when the last unit is done, move the next unit.
    if ((window.movingUnitIndex + 1) < movableUnits.length)
    {
        if (window.lastMovedUnit)
        {
            const lastMovedUnit = window.lastMovedUnit;
            const isValidUnit = (lastMovedUnit && lastMovedUnit.piece && thisGame.pieces[lastMovedUnit.piece.index].units[lastMovedUnit.index] && 
                                lastMovedUnit === thisGame.pieces[lastMovedUnit.piece.index].units[lastMovedUnit.index]);
            if (isValidUnit && !lastMovedUnit.movementComplete && !lastMovedUnit.holding)
            {
                return;
            }
        } 
        window.movingUnitIndex++;
        return;
    }
    // Clear and reset for next wave.
    clearMoveIntervals();
    window.movingUnitIndex = 0;
    window.moveWave++;
    runKomputer(thisGame);
    return;
}


function shouldBombard(thisGame, unit, finalMoveWave)
{
    return (unit && unit.piece && unit.canBombard() && (unit.movementComplete || window.moveWave >= finalMoveWave) &&
        (hasAdjacentEnemyArmy(thisGame, unit.piece) || hasAdjacentEnemyFrigate(thisGame, unit.piece)));
}


async function decideBestMove(thisGame, movePoints, unit, favorOffense, getScore = false)
{
    let bestMoveScore = -1;
    let bestMoves = [];
    for (const movePoint of movePoints)
    {
        const possibleMoveScore = await getMoveScore(thisGame, movePoint, unit, favorOffense);
        if (possibleMoveScore > bestMoveScore)
        {
            bestMoveScore = possibleMoveScore;
            bestMoves = [];
            bestMoves.push(movePoint);
        }
        else if (possibleMoveScore === bestMoveScore)
        {
            bestMoves.push(movePoint);
        }
    }
    if (getScore)
    {
        return bestMoveScore;
    }
    else
    {
        const bestMove = bestMoves.length > 1 ? getRandomItem(bestMoves) : bestMoves[0];
        if (window.hasKomputerLog)
        {
            const moveData = {game: thisGame, unit: unit, score: bestMoveScore, bestMoveIndex: bestMove.index};
            komputerLog(moveData);
        }
        return bestMove;
    }
}


async function getMoveScore(thisGame, possibleMovePoint, unit, favorOffense)
{
    // Get score in range [0, 1].
    const piece = thisGame.pieces[possibleMovePoint.index];
    const enemyColor = piece.getOpponentColor(thisGame.perspectiveColor);
    const primaryTargetColors = window.primaryTargetColors ? window.primaryTargetColors : decidePrimaryTargetColors(thisGame);
    if (unit.isFrigate())
    {
        return getFrigateMoveScore(thisGame, piece, unit, enemyColor, primaryTargetColors);
    }
    else
    {
        if (!window.enemyTargets.length)
        {
            await rankEnemyTargets(thisGame);
        }
        const terrainDefenseBonus = getTerrainDefenseBonus(piece); 
        let score = 0;
        if (piece.hasRollingOpponent(thisGame.perspectiveColor))
        {
            score = getJoinBattleScore(thisGame, unit, piece, enemyColor, primaryTargetColors);
        }
        else if (hasAdjacentEnemyLandContact(thisGame, piece))
        {
            score = getContactEnemyScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, primaryTargetColors);
        }
        else if (piece.hasCivilization(thisGame.perspectiveColor))
        {
            score = await getCivilDefenseScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, favorOffense); 
        }
        else if (piece.hasFrigate(thisGame.perspectiveColor))
        {
            score = await getBoardingFrigateScore(thisGame, unit, piece);
        }
        else
        {
            score = await getOpenCountrysideScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus);
        }
        // Clamp and dampen as safeguard. 
        score = score < 0 ? 0 : score > 1 ? 0.95 : score;
        return score;
    }
}


function decidePrimaryTargetColors(thisGame)
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
    primaryTargetColors = primaryTargetColors.length ? primaryTargetColors : enemyColors;
    window.primaryTargetColors = primaryTargetColors;
    return primaryTargetColors;
}


function getCenterPiece(thisGame)
{
    const centerPieceIndex = Math.floor((thisGame.pieces.length * 0.5) - 1);
    return thisGame.pieces[centerPieceIndex];
}


function getCenterPieceBoardPoint(thisGame)
{
    const centerPieceIndex = Math.floor((thisGame.pieces.length * 0.5) - 1);
    return thisGame.pieces[centerPieceIndex].boardPoint.clone(); 
}


function getEuclideanDistanceToPoint(pointA, pointB)
{
    return Math.sqrt((pointA.x-pointB.x)*(pointA.x-pointB.x)+(pointA.y-pointB.y)*(pointA.y-pointB.y));
}


function guessTravelCostToEnemy(thisGame, unit, pieceOrigin)
{    
    const maxDistance = 32;
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
        travelCost = thisGame.distanceBewteenPoints(pieceOrigin.boardPoint.clone(), enemyCapital.boardPoint.clone());
    }
    return travelCost;
}


function getTerrainDefenseBonus(piece)
{
    // Convert terrain defenses of [0, 1, 2] to [0.05, 0.1, 0.15].
    return 0.1 * (( piece.terrainDefenses() * 0.5 ) + 0.5);
}


function getJoinBattleScore(thisGame, unit, piece, enemyColor, primaryTargetColors)
{
    // Complete any tactical maneuver.
    if (window.isManeuveringToAttack && (piece.index === window.movingToAttackIndex && unit.piece.index === window.movingToAttackOrigin))
    {
        return 1; 
    }
    let score = 0;
    const defendingUnitCount = piece.countOpponentMilitary(thisGame.perspectiveColor);
    const defendingRollCount = piece.numDefenderRolls(piece.getOpponentColor(thisGame.perspectiveColor));
    const defensiveScore = (0.08 * defendingRollCount) + (0.04 * defendingUnitCount);
    // Check enemy "civilizations" or towns & cities.
    if (piece.hasOpponentCivilization(thisGame.perspectiveColor))
    {
        // Urgently try to retake a lost capital.
        if (piece.hasCapital(thisGame.perspectiveColor))
        {
            return 1;
        }
        // Look for undefended civs.
        if (defendingUnitCount === 0)
        {
            return piece.hasCapital(enemyColor) ? 0.99 : defendingRollCount === 1 ? 0.98 : 0.97;
        }
        // Look at all enemy civs.
        score = getCivAttackScore(thisGame, piece); 
        // Attack likely when no other battles begun or already in an ideal staging location.
        if (unit.piece.hasCapital(thisGame.perspectiveColor) || 
            ((unit.piece.isMountain() || unit.piece.isForest()) && hasAdjacentEnemyCivilization(thisGame, unit.piece)) || 
            ((unit.piece.hasCivilization(thisGame.perspectiveColor) && !unit.piece.hasAdjacentRollingEnemy(thisGame.perspectiveColor, thisGame.player.team.rulerColor))))
        {
            // Square root to strongly emphasize.
            // Square roots exponentially increase fractions without exceeding 1. 
            // Perfect for this case, and the expense is acceptable since the number of possible battles is low.
            score = Math.sqrt(score); 
        }
    }
    // Check enemy in the countryside.
    else
    {
        score = 1 - defensiveScore;
        // Prioritize enemy beseiging / pinning a friendly town.
        const hasPinOnFriendlyCiv = hasAdjacentFriendlyCiv(thisGame, piece);
        if (hasPinOnFriendlyCiv || hasAdjacentEnemyCivilization(thisGame, piece))
        {
            const minBoostPercent = 0.85 * (1 - score);
            const maxBoostPercent = 0.99 * (1 - score);
            score += boostByRandomRangePercent(score, minBoostPercent, maxBoostPercent);
            if (hasPinOnFriendlyCiv)
            {
                score = Math.cbrt(score); 
            }
        }
    }
    // Likely join battles already begun, but avoid overkill on weak targets.
    if (piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
    {
        if (isNotOverkill(thisGame, piece))
        {
            score = Math.sqrt(score); 
        }
    }
    if (!primaryTargetColors.includes(enemyColor))
    {
        score *= 0.6;
    }
    return score;
}


function getCivAttackScore(thisGame, piece)
{
    const targets = window.enemyTargets;
    const minAttackScore = 0.8;
    let minBoost = 0.125;  // If first priority target, min boosted score is 0.90; 2nd priority min score: 0.85; 3rd min: 0.82
    let maxBoost = 0.225;  // If first priority & random is 1, max score is: 0.98; 2nd priority max score: 0.89; 3rd max: 0.84
    let score = minAttackScore;
    for (let i = 0; i < targets.length; i++)
    {
        const target = targets[i];
        if (target.index === piece.index)
        {
            minBoost /= (i*i) + 1;
            maxBoost /= (i*i) + 1;
            score += boostByRandomRangePercent(score, minBoost, maxBoost);
            if (hasAdjacentEnemyArmy(thisGame, target))
            {
                score -= 0.06;
            }
        }
    }
    return score;
}


function boostByRandomRangePercent(decimalScore = 0, minDecimalPercent = 0, maxDecimalPercent = 0)
{
    // Returns a number to boost a score by some percent.
    // No score returns 0 boost, no min returns max, no max returns min or 0. 
    // Example1: Min boost returned for a score of 0.5 by 0.1 'percent' is [0.05].
    // Example2: Max boost returned for a score of 0.8 by 0.1 'percent' is between [0, 0.08]. 
    // Example3: Min-Max boosted score of 0.5 by [0.1, 0.2] 'percent' is between [0.05, 0.1].
    const minBoost = decimalScore * minDecimalPercent;
    const maxBoost = decimalScore * maxDecimalPercent * Math.random();
    return minBoost < maxBoost ? maxBoost : minBoost;
}


function hasAdjacentEnemyLandContact(thisGame, piece)
{
    return (hasAdjacentEnemyCivilization(thisGame, piece) && !piece.hasFrigate(thisGame.perspectiveColor)) || 
            (hasAdjacentEnemyArmy(thisGame, piece) && hasAdjacentBattle(thisGame, piece) && !piece.hasFrigate(thisGame.perspectiveColor))
}


function getContactEnemyScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, primaryTargetColors)
{
    const randomVariance = Math.random() * 0.0125;
    const hasAdjacent = hasAdjacentEnemyCivilization(thisGame, piece);
    let score = hasAdjacent ? 0.70 + terrainDefenseBonus : 0.65 + terrainDefenseBonus;
    score += randomVariance;
    // If in an ideal seige location, value another less.
    if ((unit.piece.isMountain()) && hasAdjacentEnemyCivilization(thisGame, unit.piece))
    {
        score -= 0.0625;
    }
    // Focus on primary targets.
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
                break;
            }
        } 
    }
    score *= isTargetPrimary? 1 : 0.6;
    // Never leave cavalry alone in the open next to an enemy civ.
    const remainingMoveAllowance = unit.movementAllowance - unit.spacesMoved;
    if (unit.isCavalry() && hasSmoothTerrain(piece) && (piece.countMilitaryUnits(piece.units) === 0) &&
        (possibleMovePoint.spacesNeeded === remainingMoveAllowance))
    {
        score = 0;
    }
    // Maybe maneuver unit before attack.
    // If unit has extra moves close to a battle, pass through open terrain to get more attack vectors.
    const canManeuverBeforeAttack = (possibleMovePoint.spacesNeeded < remainingMoveAllowance && 
        (unit.type === "c" || hasSmoothTerrain(piece)));
    if (canManeuverBeforeAttack && hasAdjacentBattle(thisGame, piece)) 
    {
        const battlePiece = findAdjacentBattle(thisGame, piece);
        const attackVectors = battlePiece.collectRetreatIndices(thisGame.perspectiveColor);
        if (!attackVectors.includes(piece.index))
        {
            window.isManeuveringToAttack = true;
            window.movingToAttackIndex = battlePiece.index;
            window.movingToAttackOrigin = piece.index;
            return 1;
        }
    }
    // Reward chance to bombard or explore.
    if (unit.isArtillery())
    {
        score *= 1.1;
    }
    else
    {
        const adjacentHiddenCount = countAdjacentHiddenTerrain(thisGame, piece); 
        if (adjacentHiddenCount)
        {
            score += adjacentHiddenCount * 0.02;
        }
    }
    return score;
}


async function getCivilDefenseScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, favorOffense) 
{
    let score = 0;
    const pinned = hasAdjacentEnemyArmy(thisGame, piece) || hasAdjacentEnemyFrigate(thisGame, piece);
    const vulnerable = await isVulnerable(thisGame, piece);
    if (vulnerable && (pinned || hasIsolatedForestCity(thisGame, piece)))
    {
        const defendingRollCount = piece.numDefenderRolls(thisGame.perspectiveColor);
        if (piece.hasCapital(thisGame.perspectiveColor) || (defendingRollCount < 3))
        {
            score = 0.97;
        }
        else
        {
            score = 0.92;
        }
        if (favorOffense)
        {
            score -= 0.125;
        }
    }
    else
    {
        score = await getOpenCountrysideScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus);
    }
    const randomVariance = Math.random() * 0.04;
    return score + randomVariance;
}


function hasIsolatedForestCity(thisGame, piece)
{
    const color = thisGame.perspectiveColor;
    return piece.isForest() && piece.hasCity(color) && !hasAdjacentArmy(thisGame, piece, color) && !piece.hasCapital(color);
}


async function getBoardingFrigateScore(thisGame, unit, piece)
{
    let score = 0;
    const frigates = findFrigates(thisGame, [thisGame.perspectiveColor], [piece]);
    const firstFrigate = frigates[0];
    const canReachEnemy = hasAmphibTarget(thisGame, firstFrigate, true, false);
    if (canReachEnemy)
    {
        for (const frigate of frigates)
        {
            const hasCapacity = frigate.cargo.length + frigate.cargoUnloaded < 3;
            if (!hasCapacity)
            {
                continue;
            }
            if (!frigate.movementComplete || hasAdjacentEnemyCivilization(thisGame, piece) || hasAdjacentEnemyArmy(thisGame, piece))
            {
                const randomVariance = Math.random() * 0.0325;
                score = 0.945 + randomVariance;
                break;
            }
        }
    }
    else
    {
        for (const frigate of frigates)
        {
            const hasCapacity = frigate.cargo.length + frigate.cargoUnloaded < 3;
            if (!hasCapacity)
            {
                continue;
            }
            let frigateScore = 0;
            const frigateMovables = getFrigateMovables(frigate);  
            if (frigateMovables && frigateMovables.length)
            {
                const getScore = true;
                frigateScore = await decideBestMove(thisGame, frigateMovables, frigate, true, getScore);
            }
            score = frigateScore * 0.5;
        }
    }
    return score;
}


async function getOpenCountrysideScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus)
{
    let score = 0;
    const travelCostToEnemy = guessTravelCostToEnemy(thisGame, unit, piece);
    const isEarlyGame = thisGame.maxMoveNumber < 25;
    let distanceToCenter = null;
    let centerWeight = 0;
    if (isEarlyGame)
    {
        distanceToCenter = getEuclideanDistanceToPoint(getCenterPieceBoardPoint(thisGame), piece.boardPoint.clone());
        centerWeight = distanceToCenter * 0.25;  
    }
    if (await hasThreat(thisGame, piece))
    {
        score = (0.36 + terrainDefenseBonus) / (travelCostToEnemy + centerWeight);
    }
    else
    {
        score = 0.46 / (travelCostToEnemy + centerWeight);
    }
    const adjacentHiddenCount = countAdjacentHiddenTerrain(thisGame, piece); 
    if (adjacentHiddenCount)
    {
        score += adjacentHiddenCount * 0.03;
    }
    // Special case - small board, first turn: 
    if (window.isSmallBoard)
    {
        const isFirstTurnMove = thisGame.pieces.getCivilizations(thisGame.perspectiveColor).length < 3;
        if (isEarlyGame && isFirstTurnMove) 
        {
            // Explore toward center.
            const firstTurnInnerEmphasizedIndecies = [15, 22, 38];
            if (firstTurnInnerEmphasizedIndecies.includes(piece.index))
            {
                score += 0.21;
            }
            // Prefer start-adjacent hexes.
            if (isAdjacent(thisGame, possibleMovePoint, unit.piece.boardPoint.clone()))
            {
                score += 0.125;
            }
        }
    } 
    return score;
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
            if (isAccessibleNow(civPiece, unit, true, false) || (hasAdjacentDeepWater(thisGame, unit.piece)  && hasAdjacentDeepWater(thisGame, civPiece)))
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
        score -= hitTarget && (hasAdjacentEnemyArmy(thisGame, piece) || hasAdjacentEnemyFrigate(thisGame, piece)) ? 0.0125 : 0;
        score -= hasEnemyFrigate ? 0.25 : 0;
        score += piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) ? 
            isAdjacent(thisGame, unit.piece.boardPoint, piece.boardPoint) ? 0.125 : 0.09375 : 0;
        score += piece.hasOpponentTown(thisGame.perspectiveColor) && !piece.isMountain() ? 0.0625 : 0;
        score += piece.hasOpponentCivilization(thisGame.perspectiveColor) ? 0.03125 : 
                piece.isMountain() ? 0.01875 : piece.isForest() ? 0.01125 : 0;
    }
    else
    {
        // Unloaded frigates should bombard, pin towns, and support friendlies.
        let friendlyArmyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
        if (friendlyArmyUnits)
        {
            const distance = getDistanceToNearestUnit(thisGame, friendlyArmyUnits, piece);
            const distanceScalar = distance > 1 ? (1 - 0.1 * distance) : 1;
            score = 0.77 * distanceScalar;
        }
        const adjacentFriendlyCivCount = countAdjacentCivilizations(thisGame, piece);
        score += adjacentFriendlyCivCount * 0.02;
        const adjacentFriendlyArmyCount = countAdjacentFriendlyArmy(thisGame, piece); 
        score += adjacentFriendlyArmyCount * 0.00875;
        score += hasAdjacentEnemyTown(thisGame, piece) ? 0.05 : 0;
        score += hasAdjacentBattle(thisGame, piece) && hasAdjacentEnemyArmy(thisGame, piece) ? 0.06 : 0;  
        score += hasAdjacentEnemyArmy(thisGame, piece, thisGame.perspectiveColor) ? 0.04 : 0;
        if (hasEnemyFrigate) 
        {
            score += 0.02;
            const enemyFrigate = piece.findFrigate(enemyColor); 
            score += enemyFrigate.hasUnloadables() ? 0.02 : 0;
            score += hasAdjacentFriendlyCiv(thisGame, piece) ? 0.04 : 0;
        }
    }
    // Clamp to [0,1.2], roughly between [0,1] with some overflow capacity.
    score = score < 0 ? 0 : score > 1.2 ? 1.2 : score;
    return score;
}


function hasAmphibTarget(thisGame, unit, viaImaginaryCargo, beyondBlockingFrigate)
{
    for (const piece of thisGame.pieces)
    {
        if (piece.hasRollingOpponent(thisGame.perspectiveColor) && !piece.hasOpponentUnit(thisGame.perspectiveColor, "f"))
        {
            if (isAccessibleNow(piece, unit, viaImaginaryCargo, beyondBlockingFrigate))
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
    else if (defenderUnitCount === 1 && !piece.hasOpponentArtillery(thisGame.perspectiveColor) && !piece.hasOpponentCivilization(thisGame.perspectiveColor) && attackerUnitCount > 1)
    {
        isOverkill = true;
    }
    else
    {
        const enemyColor = piece.getOpponentColor(thisGame.perspectiveColor);
        const defenderRollCount = piece.numDefenderRolls(enemyColor);
        const defenderPower = (1.5 * defenderRollCount) + defenderUnitCount;
        const attackerRollCount = piece.numAttackerRolls(thisGame.perspectiveColor);
        const attackerPower = (1.5 * attackerRollCount) + attackerUnitCount;
        isOverkill = defenderPower < attackerPower * 0.75 ? true : false;
    }
    return !isOverkill;
}


function guessDefensivePower(thisGame, piece, color = null)
{
    if (color === null)
    {
        color = thisGame.perspectiveColor;
    }
    const civDefenderCount = piece.getMilitaryUnitCount(color);
    const civRollCount = piece.numDefenderRolls(color);
    return (civRollCount + civDefenderCount);
}


async function guessThreat(thisGame, piece, colors = null)
{
    // Add temporary pennants to simulate enemy terrain modifiers.
    const enemyColors = colors === null ? getEnemyColors(thisGame) : colors;
    let temporaryPennants = [];
    for (const color of enemyColors)
    {
        if (color === thisGame.perspectiveColor)
        {
            continue;
        }
        for (const piece of thisGame.pieces)
        {
            if (hasRoughTerrain(piece) && piece.hasMilitary(color))
            {
                temporaryPennants.push(piece.addUnit(color, "p"));
            }
        }
    }
    let threat = guessArmyThreat(thisGame, piece, enemyColors);
    for (const pennant of temporaryPennants)
    {
        pennant.piece.removeUnit(pennant);
    }
    const enemyFrigates = findFrigates(thisGame, enemyColors);
    for (const frigate of enemyFrigates)
    {
        addPotentialCargoThreat(thisGame, piece, frigate, threat);  
    }
    // Clear flags tagged to units during the threat assessment.
    for (let unit of threat.units)
    {
        unit.isThreatCounted = false;
    }
    // Combine to estimate threat.
    const threatRollCount = guessRollCount(threat); 
    const rollScalar = 1.5;
    const navalWeight = threat.hasAmphib ? threat.frigateCount * 0.5 : 0;
    return ((threatRollCount * rollScalar) + threat.count + navalWeight);
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
    let threat = {count: 0, frigateCount: 0, units : [], hasInfantry: false, hasCavalry : false, hasArtillery: false, hasAmphib : false, hasPin : false};
    let enemyArmyUnits = getArmyUnits(thisGame, enemyColors);
    if (!enemyArmyUnits)
    {
        return threat;
    }
    if (hasAdjacentEnemyArmy(thisGame, piece))
    {
        threat.hasPin = true;
    }
    for (const unit of enemyArmyUnits)
    {
        let inRangePoints = getInRangePoints(unit);
        if (!inRangePoints)
        {
            continue;
        }
        for (const point of inRangePoints)
        {
            if (point.x === piece.boardPoint.x && point.y === piece.boardPoint.y)
            {
                unit.isThreatCounted = true;
                threat.units.push(unit);
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


function getInRangePoints(unit)  
{
    if (window.isWorldExplored)
    {
        return unit.getMovables();
    }
    return getKomputerMovables(unit);
}


function addPotentialCargoThreat(thisGame, targetPiece, frigate, knownThreat)
{
    if (!isAccessibleNow(targetPiece, frigate, true))
    {
        return;
    }
    knownThreat.frigateCount++;
    const cargoCount = frigate.cargo.length;
    knownThreat.count += cargoCount;
    knownThreat.hasAmphib = cargoCount ? true : false;
    for (const item of frigate.cargo)
    {
        if (item === "i")
        {
            knownThreat.hasInfantry = true;
            continue;
        }
        if (item === "c")
        {
            knownThreat.hasCavalry = true;
            continue;
        }
        if (item === "a")
        {
            knownThreat.hasArtillery = true;
            continue;
        }                
    }
    const maxCapacity = GamesByEmail.Viktory2Unit.CARGO_CAPACITY.f;
    let remainingCapacity = maxCapacity - cargoCount;
    if (cargoCount >= maxCapacity || remainingCapacity <= 0)
    {
        return;
    }
    const hasCargo = cargoCount > 0;
    maybeAddImaginaryCargo(frigate, hasCargo);
    const movablePoints = getFrigateMovables(frigate);
    removeImaginaryCargo(frigate);
    if (movablePoints && movablePoints.length > 0)
    {
        for (const movablePoint of movablePoints)
        {
            const reachablePiece = thisGame.pieces[movablePoint.index]
            if (reachablePiece.isLand() && reachablePiece.hasMilitary(frigate.color))
            {
                const distanceToLoadingPoint = movablePoint.spacesNeeded - 1;
                const loadingPoint = distanceToLoadingPoint === 0 ? frigate.piece.boardPoint : thisGame.pieces[movablePoint.retreatIndex].boardPoint;
                const distanceFromLoadingPointToTarget = thisGame.distanceBewteenPoints(loadingPoint, targetPiece.boardPoint);
                const movesRemaining = frigate.movementAllowance - frigate.spacesMoved;
                const canLoadAndReachTarget = (movesRemaining >= (distanceToLoadingPoint + distanceFromLoadingPointToTarget))
                if (canLoadAndReachTarget)
                {
                    knownThreat.hasAmphib = true;
                    let infantryUnits = [];
                    let cavalryUnits = [];
                    let artilleryUnits = [];
                    for (const unit of reachablePiece.units)
                    {
                        if (unit.color === frigate.color && !unit.isThreatCounted)
                        {
                            if (unit.isInfantry())
                            {
                                infantryUnits.push(unit);
                            }
                            else if (unit.isCavalry())
                            {
                                cavalryUnits.push(unit);
                            }
                            else if (unit.isArtillery())
                            {
                                artilleryUnits.push(unit);
                            }
                        }
                    }
                    let loadAttempt = 0;
                    while(remainingCapacity && (loadAttempt < maxCapacity))
                    {
                        if (!knownThreat.hasArtillery && artilleryUnits.length)
                        {
                            knownThreat.hasArtillery = true;
                            artilleryUnits[0].isThreatCounted = true;
                            knownThreat.units.push(artilleryUnits.shift());
                            knownThreat.count++;
                            remainingCapacity--;
                        } 
                        if (remainingCapacity && !knownThreat.hasCavalry && cavalryUnits.length)
                        {
                            knownThreat.hasCavalry = true;
                            cavalryUnits[0].isThreatCounted = true;
                            knownThreat.units.push(cavalryUnits.shift());
                            knownThreat.count++;
                            remainingCapacity--;
                        }
                        if (remainingCapacity && !knownThreat.hasInfantry && infantryUnits.length)
                        {
                            knownThreat.hasInfantry = true;
                            infantryUnits[0].isThreatCounted = true;
                            knownThreat.units.push(infantryUnits.shift());
                            knownThreat.count++;
                            remainingCapacity--;
                        }
                        loadAttempt++;
                    }
                }
            }
        }
    }
}


function guessRollCount(threat)
{
    let attackVectorBonus = 0;
    switch(threat.count)
    {
        case 0:
        case 1:
        {
            break;
        }
        case 2:
        case 3:
        {
            attackVectorBonus = threat.hasCavalry ? 2 : 1;
            break;
        }
        case 4:
        case 5:
        {
            attackVectorBonus = threat.hasCavalry ? 3 : 2;
            break;
        }
        default:
        {
            attackVectorBonus = threat.count * 0.5;
        }
    }       
    if (attackVectorBonus && !threat.hasPin)
    {
        attackVectorBonus--;
    }
    const maxAttackVectors = 5;
    attackVectorBonus = attackVectorBonus < maxAttackVectors ? attackVectorBonus : maxAttackVectors;
    return attackVectorBonus + threat.hasInfantry + threat.hasCavalry + threat.hasArtillery;
}


function getDistanceToNearestOtherPoint(thisGame, points, originPoint)
{
    let minDistance = Number.MAX_VALUE;
    for (const point of points)
    {
        const distance = thisGame.distanceBewteenPoints(point, originPoint);
        if ((distance < minDistance) && (distance !== 0))
        {
            minDistance = distance;
        }
    }
    return minDistance !== Number.MAX_VALUE ? minDistance : null;    
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


async function decideMoveAcceptance(thisGame, unit, destinationIndex, isHoldingWave)
{
    if (unit.piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.color))
    {
        unit.movementComplete = true;
        return false;
    }
    const destinationPiece = thisGame.pieces[destinationIndex];
    if (unit.isFrigate())
    {
        return await decideFrigateMoveAcceptance(thisGame, unit, destinationPiece);
    }
    // Consider guarding a pinned town vs attacking.
    const defenderCount = unit.piece.getMilitaryUnitCount(thisGame.perspectiveColor);
    const isPinned = hasAdjacentEnemyArmy(thisGame, unit.piece) || hasAdjacentEnemyFrigate(thisGame, unit.piece);  
    if (isPinned && unit.piece.hasCivilization(thisGame.perspectiveColor))
    {
        // Going to or from capital:
        const goingToCapital = destinationPiece.hasCapital(thisGame.perspectiveColor);
        const goingToFight = isLikelyGoingToFight(thisGame, destinationPiece);
        if (goingToCapital && goingToFight)
        {
            return true;
        }            
        const fromCapital = unit.piece.hasCapital(thisGame.perspectiveColor);
        const goingToVulnerableCiv = destinationPiece.hasCivilization(thisGame.perspectiveColor) && await isVulnerable(thisGame, destinationPiece);
        if ((fromCapital && goingToFight) || (fromCapital && goingToVulnerableCiv))
        {
            return true;
        }
        // Artillery in a town pinned by an enemy frigate should definitely stay to shoot the frigate. 
        if (unit.isArtillery() && unit.piece.hasTown(thisGame.perspectiveColor) && hasAdjacentEnemyFrigate(thisGame, unit.piece))
        {
            unit.movementComplete = true;
            return false;
        }
        // Pinned defending cavalry might join any city battle that doesn't have friendly cavalry or attack an unguarded town.
        if (unit.isCavalry())
        {
            const color = thisGame.perspectiveColor;
            const defendingHome = unit.piece.isGrassland() && unit.piece.hasCity(color);
            const probability = defendingHome ? 0.4 : 0.8;
            const shouldAttack = Math.random() < probability;
            const hasBattle = destinationPiece.hasBattle(color, color);
            const hasCity = destinationPiece.hasOpponentCity(color);
            const hasCavalry = destinationPiece.hasCavalry(color);
            const hasTown = destinationPiece.hasOpponentTown(color);
            const unguarded = destinationPiece.countOpponentMilitary(color) === 0;
            if (shouldAttack && ((hasBattle && hasCity && !hasCavalry) || (hasTown && unguarded)))
            {
                return true;
            }
        } 
        // For last pinned defenders:
        if (defenderCount === 1)
        {
            const attackingToBreakSiege = (destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) && isAdjacent(thisGame, unit.piece.boardPoint.clone(), destinationPiece.boardPoint.clone())) || window.movingToAttackIndex === destinationPiece.index;
            if (attackingToBreakSiege && hasAdjacentSupport(thisGame, unit.piece) && hasWeakPin(thisGame, unit.piece))
            {
                return true;
            }
            else 
            {
                hold(unit, isHoldingWave);
                return false;                 
            }
        }
        // When second-to-last unit is infantry with cavalry or artillery:
        if (defenderCount === 2 && unit.isInfantry())
        {
            // Hold the infantry, let the cavalry go first.
            if (unit.piece.hasCavalry(thisGame.perspectiveColor))
            {
                hold(unit, isHoldingWave);
                return false; 
            }
            // Maybe hold the infantry.
            if (unit.piece.hasArtillery(thisGame.perspectiveColor) && Math.random() < 0.4)
            {
                hold(unit, isHoldingWave);
                return false; 
            }
        }
        // When destination has grave danger, and pinned origin has other defense:
        if (destinationPiece.hasCivilization(thisGame.perspectiveColor) && await hasGraveDanger(thisGame, destinationPiece))
        {
            return true;
        }
        // When pinned origin is vulnerable:
        const vulnerable = await isVulnerable(thisGame, unit.piece);
        if ((vulnerable && !goingToFight) || (vulnerable && !isAdjacent(thisGame, unit.piece.boardPoint.clone(), destinationPiece.boardPoint.clone())))
        {
            hold(unit, isHoldingWave);
            return false;       
        }
    }
    else if (await shouldPinnedInfantryHoldHighGround(thisGame, unit, isPinned, defenderCount, destinationPiece))
    {
        hold(unit, isHoldingWave);
        return false;
    }
    else if (hasIsolatedForestCity(thisGame, unit.piece) && !isAdjacent(thisGame, destinationPiece.boardPoint.clone(), unit.piece.boardPoint.clone()) 
        && await isVulnerable(thisGame, unit.piece))
    {
        hold(unit, isHoldingWave);
        return false;
    }
    // Default case: accept move.
    return true;
}


function hold(unit, isHoldingWave)
{
    window.lastMovedUnit = unit;
    if (isHoldingWave)
    {
        unit.holding = false;
        unit.movementComplete = true;
    }
    else if (!unit.holding)
    {
        unit.holding = true;
        window.holdingUnits.push(unit);
    }
}


function isLikelyGoingToFight(thisGame, destinationPiece)
{
    return ( destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) || window.isManeuveringToAttack || destinationPiece.hasFrigate(thisGame.perspectiveColor));
}



async function decideFrigateMoveAcceptance(thisGame, frigate, destinationPiece)
{
    // Loaded frigates may always move.
    if (frigate.hasUnloadables())
    {
        return true;
    }
    else
    {
        // Frigates that can bombard an adjacent battle should stay.
        if (hasAdjacentBattle(thisGame, frigate.piece) && hasAdjacentEnemyArmy(thisGame, frigate.piece))
        {
            frigate.movementComplete = true;
            return false;
        }
        // When a frigate pins an enemy town, only move for a battle or to another pin.
        const pinsEnemyTown = hasAdjacentEnemyTown(thisGame, frigate.piece);
        const movingToPin =  hasAdjacentEnemyTown(thisGame, destinationPiece);
        const movingToBattle = hasAdjacentBattle(thisGame, destinationPiece);
        if (pinsEnemyTown && !movingToPin && !movingToBattle)
        {
            frigate.movementComplete = true;
            return false;
        }
        // When guarding a vulnerable friendly civ, only move for a battle.
        if (await shouldGuardAdjacentCiv(thisGame, frigate) && !hasAdjacentBattle(thisGame, destinationPiece))
        {
            frigate.movementComplete = true;
            return false;
        }
    }
    return true;
}


async function shouldGuardAdjacentCiv(thisGame, frigate)
{
    let shouldGuard = false;        
    const friendlyCivs = findAdjacentFriendlyCivs(thisGame, frigate.piece);
    for (const friendlyCiv of friendlyCivs)
    {
        if (await isVulnerable(thisGame, friendlyCiv))
        {
            const civNavalSupportCount = countAdjacentFrigates(thisGame, friendlyCiv);
            if (civNavalSupportCount <= 1)
            {
                shouldGuard = true;
                break;
            }
        }
    }
    return shouldGuard;
}


async function shouldPinnedInfantryHoldHighGround(thisGame, unit, isPinned, defenderCount, destinationPiece)
{
    return (isPinned && unit.piece.isMountain() && unit.isInfantry() && defenderCount === 1 && 
    !window.isManeuveringToAttack && !destinationPiece.hasRollingOpponent(thisGame.perspectiveColor) && !destinationPiece.hasFrigate(thisGame.perspectiveColor) &&
    !(destinationPiece.hasCivilization(thisGame.perspectiveColor) && hasAdjacentEnemyArmy(thisGame, destinationPiece) && await hasGraveDanger(thisGame, destinationPiece)));
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
    let totalEnemyCount = 0;
    const adjacentPieceIndices = piece.getAdjacentIndecies(1);
    for (const adjacentPieceIndex of adjacentPieceIndices)
    {
        const adjacentPiece = thisGame.pieces[adjacentPieceIndex];
        const pieceEnemyCount = adjacentPiece.countOpponentMilitary(thisGame.perspectiveColor);
        if (pieceEnemyCount > 0 && adjacentPiece.isMountain())
        {
            return false;
        }
        totalEnemyCount += pieceEnemyCount;
        if (totalEnemyCount > 1)
        {
            return false;
        }
    }
    return true;
}


async function isVulnerable(thisGame, piece)
{
    const defensivePower = guessDefensivePower(thisGame, piece);
    const threat = await guessThreat(thisGame, piece);
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
        playSound("bombard_" + unit.type);
        setTimeout(function(){
            const hasFired = bombardUnitsSimulateMouseUp(thisGame, targetScreenPoint);
            if (hasFired)
            {
                const commitDelay = 600;
                setTimeout(function(){
                    thisGame.overlayCommitOnClick();
                    setTimeout(function(){ replaceBattleMessage() }, 16);
                    // Apply hits.
                    const applyHitsDelay = 100;
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
                        // Double check this is set. Use game reference for reliability.
                        thisGame.pieces[unit.piece.index].units[unit.index].hasBombarded = true;
                        thisGame.pieces[unit.piece.index].units[unit.index].noBombard = true;
                        thisGame.pieces[unit.piece.index].updateUnitDisplay()
                        setTimeout(function(){
                            thisGame.pieces[targetPiece.index].bombardOkClick(thisGame.player.team.color);
                            const processUpdateDelay = 100;
                            setTimeout(function(){
                                komputerLog("Bombardment!");
                                window.isBombarding = false;
                                runKomputer(thisGame);
                            }, processUpdateDelay)
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
    if (window.stopKomputer === true)
    {
        stopAndReset();
        return;
    }
    if (window.hasBattleBegun)
    {
        return;
    }
    window.hasBattleBegun = true;
    battlePiece.setBorder(true);
    clearMoveIntervals();
    clearReserveIntervals();
    commitExploration(thisGame);
    hideEndTurnButtons();
    playSound("battleRoll");
    const anyColor = -1;
    if (battlePiece.hasCavalry(anyColor))
    {
        playSound("battleCavalry");
    }
    if (battlePiece.hasArtillery(anyColor) || battlePiece.hasFrigate(anyColor))
    {
        playSound("battleArtillery");
    }
    const markBattleDelay = 500;
    setTimeout(function()
    {
        selectBattle(thisGame, battlePiece);
        const rollDelay = 600;
        setTimeout(function roll(){
            if (thisGame.pieces[battlePiece.index].hasArtillery(anyColor))
            {
                playSound("battleArtillery");
            }
            thisGame.overlayCommitOnClick();
            setTimeout(replaceBattleMessage, 100);
            const applyHitsDelay = 600;
            setTimeout(function(){
                hideEndTurnButtons();
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
                // Roll again or close after review.
                const battleReviewDelay = 1700;
                setTimeout(function handleRollResult(){ 
                    if (!isWon(thisGame))
                    {
                        // Caution - this is a "gotcha" bug waiting to happen, as it happened twice already.
                        // Don't shorten below to: battlePiece.battleOkClick(thisGame.perspectiveColor);
                        // The battlePiece object is no longer a reference to the game piece! 
                        // Many bothans died to bring us this information.
                        const rollResult = document.getElementById("Foundation_Elemental_" + GameVersion + "_battleOk");
                        if (rollResult)
                        {
                            thisGame.pieces[battlePiece.index].battleOkClick(thisGame.player.team.color);
                            window.waitCount = 0;
                            hideEndTurnButtons();
                            replaceBattleMessage();
                            const reRollDelay = 1200;
                            setTimeout(function(){
                                const rollRequired = document.getElementById("Foundation_Elemental_" + GameVersion + "_overlayCommit");
                                if (rollRequired)
                                {
                                    if (window.stopKomputer === true)
                                    {
                                        stopAndReset();
                                        return;
                                    }
                                    playSound("battleRollShort");
                                    setTimeout(function reroll(){ roll() }, 300);
                                }
                                else
                                {
                                    const piece = thisGame.pieces[battlePiece.index];
                                    const hasFriendlyMilitary = piece.hasMilitary(thisGame.perspectiveColor);
                                    const hasCapturedCapital = hasFriendlyMilitary && piece.hasOpponentCapital(thisGame.perspectiveColor);
                                    if (hasCapturedCapital && !isWon(thisGame))
                                    {
                                        playSound("lose");
                                    }
                                    if (window.stopKomputer === true)
                                    {
                                        stopAndReset();
                                        return;
                                    }
                                    if (isReserveBattle)
                                    {
                                        hideEndTurnButtons()
                                        setTimeout(function(){
                                            const battleReview = document.getElementById("Foundation_Elemental_" + GameVersion + "_battleOk");
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
                                        ensureMovementComplete(thisGame, piece.index);
                                        thisGame.update();
                                        const afterBattleDelay = 1000;
                                        setTimeout(function()
                                        {
                                            window.hasBattleBegun = false; 
                                            runKomputer(thisGame) 
                                        }, afterBattleDelay);
                                    }
                                }
                            }, reRollDelay);
                        } // No roll result, extremely rare but possible - try again or quit.
                        else
                        {
                            setTimeout(function()
                            {
                                window.waitCount++;
                                if (window.waitCount > 2)
                                {
                                    komputerLog("Battle result missing. Will stop and reset.");
                                    stopAndReset(true);
                                    return;
                                }
                                handleRollResult();       
                            }, 600);
                        }
                    }
                    // Game won. Reset for start.
                    else
                    {
                        playSound("win");
                        thisGame.maxMoveNumber = 0;
                        window.isKomputerReady = true;
                        resetKomputerButtonStyle(true);
                        komputerLog("Viktory.");
                    }
                }, battleReviewDelay);
            }, applyHitsDelay);
        }, rollDelay);
    }, markBattleDelay);
}


function isWon(thisGame)
{
    return thisGame.movePhase === 0;
}


function commitExploration(thisGame)
{
    const explorationPopup = document.getElementById("Foundation_Elemental_" + GameVersion + "_overlayCommit");
    const endTurnCommit = document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyTurn");
    if (explorationPopup && !endTurnCommit)
    {
        thisGame.overlayCommitOnClick();
        return true;
    }
    return false;
}


function selectBattle(thisGame, battlePiece)
{
    thisGame.moveUnitsMouseDown(battlePiece.$screenRect.getCenter());
}


function replaceBattleMessage()
{
    let battleMessage = document.querySelector("#Foundation_Elemental_" + GameVersion + "_centerOverPiece > tbody > tr:nth-child(3) > td");
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
    if (isBombarding)
    {
        setTimeout(function(){ thisPiece.bombardOkClick(attackerColor) }, 400);
    }
}


function ensureMovementComplete(thisGame, pieceIndex)
{
    const piece = thisGame.pieces[pieceIndex];
    for (let unit of piece.units)
    {
        if (unit.isMilitary())
        {
            unit.spacesMoved = unit.movementAllowance;
            unit.movementComplete = true;
        }
    }
}


function placeReserves(thisGame)
{
    clearMoveIntervals();
    clearReserveIntervals();
    window.reserveIntervalIds.push(setInterval(placeReserveUnit, 1200, thisGame));
}


async function placeReserveUnit(thisGame)
{
    ensureValidBoard(thisGame);
    if (window.stopKomputer === true)
    {
        stopAndReset();
        return;
    }
    if (window.hasBattleBegun || window.isExploring || window.unitRecall)
    {
        return;
    }
    hideEndTurnButtons();
    const reserveUnits = thisGame.player.team.reserveUnits;
    const controlsCapital = thisGame.doesColorControlTheirCapital(thisGame.player.team.color);
    let hasPlayableReserveUnit = false;
    if (reserveUnits.length > 0)
    {
        for (let i = reserveUnits.length - 1; i >= 0; i--)
        {
            if (thisGame.couldPlaceReserveUnit(reserveUnits[i], thisGame.player.team.color, controlsCapital))
            {
                const element = document.querySelector("#Foundation_Elemental_" + GameVersion + "_reserve_" + i);
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
        const isCivilization = (movingUnitType === "t" || movingUnitType === "y")
        const destinationBoardPoint = isCivilization ? (
            await getBestBuildable(thisGame) ) : (
            await getBestReservable(thisGame, movingUnitType, controlsCapital) );
        const destinationScreenPoint = thisGame.screenRectFromBoardPoint(destinationBoardPoint).getCenter();
        thisGame.placeReserveOnMouseUp(destinationScreenPoint);
        hideEndTurnButtons();
        // Maybe settle exploration.
        if (document.getElementById("Foundation_Elemental_" + GameVersion + "_overlayCommit") &&
            !document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyTurn"))
        {
            clearReserveIntervals();
            settleCivExploredTerrain(thisGame, destinationBoardPoint);
        }
    }
    // End placing reserves. 
    else
    {
        window.unitRecall = true;
        clearReserveIntervals();
        setTimeout(async function()
        {
            ensureValidBoard(thisGame);
            await maybeRecallTroops(thisGame);
            await maybeRecallFrigatesToPort(thisGame);
            window.unitRecall = false;
            maybeFightReserveBattle(thisGame);
            if (!thisGame.hasBattlesPending && !window.hasBattleBegun)
            {
                commitExploration(thisGame);
                setTimeout(function(){ endReservePhase(thisGame) }, 200);
            }
        }, 100);
    }
}


function settleCivExploredTerrain(thisGame, civBoardPoint)
{
    window.isExploring = true;
    thisGame.overlayCommitOnClick();
    komputerLog("Civilization exploring.");
    setTimeout(function()
    {
        const hexTerrain = thisGame.getMapCustomizationData();
        if (hexTerrain.length > 0)
        {
            const waterPopup = document.getElementById("Foundation_Elemental_" + GameVersion + "_waterSwap");
            const isEarlyGame = thisGame.maxMoveNumber < 16;
            if ((waterPopup && isEarlyGame) || 
                (waterPopup && (Math.random() < 0.2)))
            {
                thisGame.swapWaterForLand();
                komputerLog("Water swap!");
            }
            const civPiece = thisGame.pieces.findAtPoint(civBoardPoint);
            if(window.isSmallBoard && (civPiece.index === 7 || civPiece.index === 36) ||
                window.isLargeBoard && (civPiece.index === 9 || civPiece.index === 62))
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
    clearReserveIntervals();
    if (window.currentPlayerTurn === thisGame.perspectiveColor)
    {
        thisGame.moveToNextPlayer();
        thisGame.sendMove();
    }
    KomputerSound.bellsPlayedThisTurn = false;
    setTimeout(function()
    {
        window.isKomputerReady = true;
        resetKomputerButtonStyle(false);
        komputerLog("Done.");
    }, 200)
}


function maybeFightReserveBattle(thisGame)
{
    if (thisGame.hasBattlesPending && !window.hasBattleBegun)
    {
        const battlePiece = findNextBattle(thisGame);
        if (battlePiece)
        {
            komputerLog("Handling reserve battle.");
            fightBattle(thisGame, battlePiece, true);
        }
    }    
}


async function getBestBuildable(thisGame)
{
    let buildablePoints = thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor);
    const playerCivs = thisGame.pieces.getCivilizations(thisGame.perspectiveColor);
    const playerCivCount = playerCivs.length;
    const totalCivCount = thisGame.pieces.getCivilizations(-1).length;
    const maxEarlyPlayerCivCount = 3;
    const maxEarlyTotalCivCount = 6; 
    const isEarlyGame = (playerCivCount < maxEarlyPlayerCivCount) && (totalCivCount < maxEarlyTotalCivCount);  
    if (isEarlyGame)
    {
        return getEarlyGameStrongPoint(thisGame, buildablePoints, playerCivCount, playerCivs);  
    }
    // Return any closest threatened town point.
    let buildablePieces = [];
    sortByClosestToEnemy(thisGame, buildablePoints);
    for (const point of buildablePoints)
    {
        const piece = thisGame.pieces.findAtPoint(point);
        if (piece.hasTown(thisGame.perspectiveColor) && await isVulnerable(thisGame, piece))
        {
            return point;
        }
        buildablePieces.push(piece);
    }
    // Build map central towns first, with priority on weaker towns.
    const centerPiece = getCenterPiece(thisGame);
    const centralIndices = centerPiece.getAdjacentIndecies(1).concat(centerPiece.index);
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
    // Stash closest to enemy.
    const closestToEnemyPoint = buildablePoints[0];
    // For any new terrain, build closest to the capital.  
    sortByClosestToCapital(thisGame, buildablePoints);
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
    // If no new terrain: build closest to the capital on open terrain.
    for (const point of buildablePoints)
    {
        if (thisGame.pieces.findAtPoint(point).hasTown(thisGame.perspectiveColor))
        {
            continue;
        }
        return point;
    }
    // If no open terrain: reinforce a central point or side wing closest to the enemy.
    const defaultPoint = closestToEnemyPoint; 
    return (bestCentralPoint && thisGame.pieces.findAtPoint(defaultPoint).hasTown(thisGame.perspectiveColor)) ? 
        bestCentralPoint : buildWingsBeforeTail(thisGame, buildablePoints, defaultPoint);
}


function getEarlyGameStrongPoint(thisGame, buildablePoints, currentCivCount, currentCivs)
{
    const red = 0;
    const isPlayingRed = thisGame.perspectiveColor === red;
    const isCenterTownRed = getCenterPiece(thisGame).hasTown(red);
    const friendlyTownPoints = thisGame.pieces.findAllWithUnitType(thisGame.perspectiveColor, "t")
    const friendlyCityPoints = thisGame.pieces.findAllWithUnitType(thisGame.perspectiveColor, "y")
    const friendlyCivPoints = (friendlyTownPoints || []).concat(friendlyCityPoints || []);
    const centerPoint = getCenterPieceBoardPoint(thisGame);
    let minDistance = Number.MAX_VALUE;
    let strongPoint = null;
    let primaryTargetFound = false;
    for (let index = 0; index < buildablePoints.length; index++)
    {
        const buildablePoint = buildablePoints[index];
        const distanceToCenter = thisGame.distanceBewteenPoints(centerPoint, buildablePoint);
        const distanceToNearestFriendlyCiv = getDistanceToNearestOtherPoint(thisGame, friendlyCivPoints, buildablePoint); 
        const distanceToPowerAnchors = distanceToNearestFriendlyCiv ? 0.5 * (distanceToCenter + distanceToNearestFriendlyCiv) : distanceToCenter;
        const isExactCenter = distanceToCenter === 0;
        if (window.isSmallBoard && isExactCenter)
        {
            // If the exact center is strong (a rare case), take it.
            if (isCenterStrong(thisGame))
            {
                strongPoint = buildablePoint;
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
        if (window.isSmallBoard && isPlayingRed)
        {   
            if (isCenterTownRed)
            {
                if (isCenterSupportHexAvailable(thisGame, buildablePoints, index))
                {
                    strongPoint = buildablePoint;
                    primaryTargetFound = true;
                }
            }
            else if (isWedgeHexAvailable(thisGame, buildablePoints, index))
            {
                const wedgeCenter = thisGame.pieces[22];
                if (wedgeCenter.hidden || !hasVerticalWaterway(thisGame, wedgeCenter))  
                {
                    strongPoint = buildablePoint;
                    primaryTargetFound = true;
                }
            }        
        }
        // Look for hexes closest to the center.
        if (!primaryTargetFound && distanceToPowerAnchors < minDistance)  
        {
            minDistance = distanceToPowerAnchors;  
            strongPoint = buildablePoint;
        }
        // Break ties by terrain and water access.
        else if (!primaryTargetFound && distanceToPowerAnchors === minDistance) 
        {
            let strongPointPiece = thisGame.pieces.findAtPoint(strongPoint);
            const strongPointDefenses = strongPointPiece.terrainDefenses();
            const strongPointAdjacentWaterCount = countAdjacentInlandSea(thisGame, strongPointPiece);
            const strongPointHasVerticalWaterwayBonus = hasVerticalWaterway(thisGame, strongPointPiece) ? 2 : 0;
            const strongPointShipyardBonus = (strongPointDefenses === 1 && strongPointAdjacentWaterCount > 2) ? 2 : 0;
            const otherPointPiece = thisGame.pieces.findAtPoint(buildablePoint);
            const otherPointDefenses = otherPointPiece.terrainDefenses();
            const otherPointAdjacentWaterCount = countAdjacentInlandSea(thisGame, otherPointPiece);
            const otherPointHasVerticalWaterwayBonus = hasVerticalWaterway(thisGame, otherPointPiece) ? 2 : 0;
            const otherPointShipyardBonus = (otherPointDefenses === 1 && strongPointAdjacentWaterCount > 2) ? 2 : 0;
            const strongPointComboStrength = strongPointDefenses + strongPointAdjacentWaterCount + strongPointShipyardBonus + strongPointHasVerticalWaterwayBonus;
            const otherPointComboStrength = otherPointDefenses + otherPointAdjacentWaterCount + otherPointShipyardBonus + otherPointHasVerticalWaterwayBonus; 
            if (strongPointComboStrength < otherPointComboStrength)
            {
                strongPoint = buildablePoint;
                strongPointPiece = otherPointPiece;
            }
            else if (strongPointComboStrength === otherPointComboStrength)
            {
                if (strongPointDefenses < otherPointDefenses ||
                    strongPointPiece.boardValue === "p" && otherPointPiece.boardValue === "g")
                {
                    strongPoint = buildablePoint;
                    strongPointPiece = otherPointPiece;
                }    
            }
        }
    }
    strongPoint = buildWingsBeforeTail(thisGame, buildablePoints, strongPoint, currentCivCount, currentCivs);
    strongPoint = preventOverForestation(thisGame, buildablePoints, strongPoint, currentCivs);
    return strongPoint;
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


// Of the original ~5 hexes, build up side-flanks before back-center.
function buildWingsBeforeTail(thisGame, buildablePoints, strongPoint)
{
    if (window.isSmallBoard)
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


function preventOverForestation(thisGame, buildablePoints, strongPoint, currentCivs, maxDesiredForestCount = 2)
{
    let overForestedDanger = false;
    if (currentCivs.length === maxDesiredForestCount)
    {
        let strongPiece = thisGame.pieces.findAtPoint(strongPoint);
        if (strongPiece && strongPiece.isForest())
        {
            const forestCount = countTerrain(currentCivs, "f");
            if (forestCount >= maxDesiredForestCount)
            {
                overForestedDanger = true;
            }
        }
    }
    if (overForestedDanger)
    {
        for (const point of buildablePoints)
        {
            const piece = thisGame.pieces.findAtPoint(point);
            if (!piece.isForest())
            {
                strongPoint = point;
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


function countTerrain(pieces, terrainValue)
{
    let count = 0;
    for (const piece of pieces)
    {
        if (piece.boardValue === terrainValue)
        {
            count++;
        }
    }
    return count;
}


async function getBestReservable(thisGame, movingUnitType, controlsCapital)
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
    // Sort by closest to enemy, push capital to the end.
    sortByClosestToEnemy(thisGame, reservables);
    const capitalPoint = thisGame.pieces.findCapitalPiece(thisGame.perspectiveColor).boardPoint.clone();
    for (let i = reservables.length -1; i >= 0; i--)
    {
        if (reservables[i].equals(capitalPoint))
        {
            reservables.push(reservables.splice(i,1)[0]);
        }
    }
    // Guard any empty threatened town, from closest to the enemy.
    for (const reservable of reservables)
    {
        const piece = thisGame.pieces.findAtPoint(reservable);
        if (await hasThreat(thisGame, piece) && !hasArmy(piece, thisGame.perspectiveColor))
        {
            return reservable;
        }
    }
    // Guard any vulnerable town.
    for (const reservable of reservables)
    {
        const piece = thisGame.pieces.findAtPoint(reservable);
        if (await isVulnerable(thisGame, piece))
        {
            return reservable;
        }
    }
    // Place closest to enemy.
    return reservables[0];
}


function findFirstTurnReservable(thisGame, reservables)
{
    const topCenterIndex = window.isSmallBoard ? 51 : thisGame.numberOfDistinctPlayers === 2 ? 79 : null;
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
                const piece = thisGame.pieces[index]; 
                if (hasSmoothTerrain(piece))
                {
                    return townPoint;       
                }
            }
            const capital = thisGame.pieces.findCapitalPiece(thisGame.perspectiveColor);
            adjacentIndecies = capital.getAdjacentIndecies(1);
            for (const index of adjacentIndecies)
            {
                const piece = thisGame.pieces[index];
                if (hasSmoothTerrain(piece))
                {
                    return capital.boardPoint.clone();
                }
            }
        }
    }
    return null;
}


function hasSmoothTerrain(piece)
{
    return (piece.isPlain() || piece.isGrassland());
}


function hasRoughTerrain(piece)
{
    return (piece.isMountain() || piece.isForest());
}


function sortByClosestToCapital(thisGame, points)
{
    const capitalPoint = thisGame.pieces.findCapitalPiece(thisGame.perspectiveColor).boardPoint.clone();
    for (let point of points)
    {
        point.distanceToCapital = thisGame.distanceBewteenPoints(point, capitalPoint);
    }
    points.sort(function(a, b){ return a.distanceToCapital - b.distanceToCapital });
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


// Clone of codebase function modified to get any terrain type, including water.
function getRandomAvailableHexValue(thisGame)
{
    let playOptions=thisGame.playOptions;
    let available=new Array();
    let tileBank=thisGame.resource("tileBank");
    let hexTypes=["p", "g", "f", "m", "w"];
    for (let i=0;i<hexTypes.length;i++)
    {
        let hexType=hexTypes[i];
        let num=tileBank[hexType]-thisGame.pieces.countHexType(hexType);
        for (let j=0;j<playOptions.mapCustomizationData.length;j++)
        {
            if (playOptions.mapCustomizationData.charAt(j)==hexType)
            {
                num--;
            }
        }
        for (let j=0;j<num;j++)
        {
            available.push(hexType);
        }
    }
    if (available.length==0)
        available=hexTypes;
    return available[GamesByEmail.random(available.length-1)];
}


async function maybeRecallTroops(thisGame)
{
    if (thisGame.playOptions.redeployment)
    {
        let armyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
        if (armyUnits && armyUnits.length > 0)
        {
            await counterGraveDanger(thisGame, armyUnits);
            armyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
            await counterThreats(thisGame, armyUnits);
            recallSittingDuckCavalry(thisGame);
        }
    }
    else
    {
        komputerLog("Redeployment blocked by game options.")
    }
}


function recallSittingDuckCavalry(thisGame)
{
    const color = thisGame.perspectiveColor;
    for (const piece of thisGame.pieces)
    {
        if (hasSittingDuckCavalry(thisGame, piece, color))
        {
            const cavalry = findAllCavalry(piece);
            for (const unit of cavalry)
            {
                const reservables = thisGame.pieces.getReservables(color,color,unit.type,thisGame.doesColorControlTheirCapital(color));
                if (reservables && reservables.length > 0)
                {
                    for (let index = 0; index < reservables.length; index++)
                    {
                        const reservablePoint = reservables[index];
                        const civPiece = thisGame.pieces.findAtPoint(reservablePoint);
                        const lastIndex = reservables.length - 1;
                        if (civPiece.hasCapital(color) && index !== lastIndex)
                        {
                            reservables.push(reservables.splice(index, 1)[0]);
                            index--;
                            continue;
                        }
                        thisGame.reservePhaseOnMouseDown(unit.screenPoint);
                        const targetPiece = thisGame.pieces.findAtPoint(reservablePoint);
                        const targetScreenPoint = targetPiece.$screenRect.getCenter();
                        const success = thisGame.redeployUnitsMouseUp(targetScreenPoint);
                        if (success)
                        {
                            komputerLog("Sitting duck cavalry recalled!")
                        }
                        else
                        {
                            console.warn("Cavalry recall failed. Logging unit and target point.");
                            console.log(unit);
                            console.log(reservablePoint);
                        }
                        break;
                    }
                }
            }
        }
    }
}


function hasSittingDuckCavalry(thisGame, piece, cavColor = null)
{
    const color = cavColor === null ? thisGame.perspectiveColor : cavColor;
    if (hasSmoothTerrain(piece) && piece.hasCavalry(color))
    {
        if (!piece.hasCivilization(color) && !piece.hasInfantry(color) && !piece.hasArtillery(color))
        {
            return true;
        }        
    }
    return false;
}


function findAllCavalry(piece)
{
    const cavalry = [];
    for (const unit of piece.units)
    {
        if (unit.isCavalry())
        {
            cavalry.push(unit);
        }
    }
    return cavalry;
}


async function counterGraveDanger(thisGame, armyUnits)
{
    const usingCavalry = false;
    let recallUnits = await getPrioritizedRecallUnits(thisGame, armyUnits, usingCavalry);
    for (let unitIndex = 0; unitIndex < recallUnits.length; unitIndex++)
    {
        const unit = recallUnits[unitIndex];
        if (isLoneCivDefender(thisGame, unit) && await hasThreat(thisGame, unit.piece))
        {
            continue;
        }
        const reservables = thisGame.pieces.getReservables(unit.color,unit.rulerColor,unit.type,thisGame.doesColorControlTheirCapital(unit.color));
        if (reservables && reservables.length > 0)
        {
            for (const reservablePoint of reservables)
            {
                const civPiece = thisGame.pieces.findAtPoint(reservablePoint);
                if (await hasGraveDanger(thisGame, civPiece))
                {
                    thisGame.reservePhaseOnMouseDown(unit.screenPoint);
                    const targetPiece = thisGame.pieces.findAtPoint(reservablePoint);
                    const targetScreenPoint = targetPiece.$screenRect.getCenter();
                    let success = thisGame.redeployUnitsMouseUp(targetScreenPoint);
                    if (success)
                    {
                        komputerLog("Troops recalled for civil defense!")
                    }
                    else
                    {
                        console.warn("Troop recall failed. Will log unit and target point.");
                        komputerLog(unit);
                        komputerLog(reservablePoint);
                    }
                    break;
                }
            }
        }
    }
}


async function counterThreats(thisGame, armyUnits)
{
    const usingCavalry = true;
    let recallUnits = await getPrioritizedRecallUnits(thisGame, armyUnits, usingCavalry);
    for (let unitIndex = 0; unitIndex < recallUnits.length; unitIndex++)
    {
        const unit = recallUnits[unitIndex];
        if ((isLoneCivDefender(thisGame, unit) || isSecondCivDefender(thisGame, unit)) && await hasThreat(thisGame, unit.piece))
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
                if (await isVulnerable(thisGame, civPiece))
                {
                    if (civPiece.index === unit.piece.index)
                    {
                        break;        
                    }
                    thisGame.reservePhaseOnMouseDown(unit.screenPoint);
                    const targetPiece = thisGame.pieces.findAtPoint(reservablePoint);
                    const targetScreenPoint = targetPiece.$screenRect.getCenter();
                    const success = thisGame.redeployUnitsMouseUp(targetScreenPoint);
                    if (success)
                    {
                        komputerLog("Troops recalled for civil defense!")
                    }
                    else
                    {
                        console.komputerLog("Troop recall failed. Logging unit and target point.");
                        console.log(unit);
                        console.log(reservablePoint);
                    }
                    break;
                }
            }
        }
    }
}


async function getPrioritizedRecallUnits(thisGame, units, usingCavalry)
{
    // Avoid recall of troops near the enemy, as these may be pinned or holding a seige. 
    orderByDistanceToEnemy(thisGame, units, false);
    let primaryRecall = [];
    let secondaryRecall = [];
    let tertiaryRecall = [];
    for (let i = units.length-1; i >= 0; i--)
    {
        const unit = units[i];
        const piece = unit.piece;
        // Avoid recall of cavalry, which do best to support other troops and, unlike artillery, have no advantage alone.
        const unitAcceptable = usingCavalry ? true : !unit.isCavalry();        
        // Recall units from any large field army.
        if (unitAcceptable && !piece.hasCivilization(thisGame.perspectiveColor) && piece.countMilitaryUnits(piece.units) > 2)
        {   
            primaryRecall = primaryRecall.concat(units.splice(i, 1));
            continue;
        }
        // Recall units from any large civil army.
        else if (unitAcceptable && piece.hasCivilization(thisGame.perspectiveColor) && piece.countMilitaryUnits(piece.units) > 2)
        {
            secondaryRecall = secondaryRecall.concat(units.splice(i, 1));
            continue;
        }        
        // Recall any acceptable.
        else if (unitAcceptable)
        {
            tertiaryRecall = tertiaryRecall.concat(units.splice(i, 1));
        }
    }
    // Sort by zIndex to ensure selectable units are accessed first.
    primaryRecall.sort(function(a, b){return (b.zIndex - a.zIndex) });
    secondaryRecall.sort(function(a, b){return (b.zIndex - a.zIndex) });
    tertiaryRecall.sort(function(a, b){return (b.zIndex - a.zIndex) }); 
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


async function hasThreat(thisGame, piece)
{
    return piece ? (await guessThreat(thisGame, piece) > 0) : false;
}


async function hasGraveDanger(thisGame, civPiece)
{
    if (civPiece)
    {
        const weightedDangerThreshold = (civPiece.hasTown(thisGame.perspectiveColor) && !civPiece.isMountain()) ? 0 : 2;
        return ((civPiece.countMilitaryUnits(civPiece.units) === 0) && (await guessThreat(thisGame, civPiece) > weightedDangerThreshold));
    }
    return false;
}


async function maybeRecallFrigatesToPort(thisGame)
{
    if (!thisGame.playOptions.redeployment)
    {
        return;
    }
    const frigates = findFrigates(thisGame, [thisGame.perspectiveColor]);
    if (frigates.length === 0)
    {
        return;
    }
    for (const frigate of frigates)
    { 
        if (await noRecall(thisGame, frigate))
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
                        // A vulnerable port is a primary target.
                        if (await isVulnerable(thisGame, possiblePort))
                        {
                            let runCount = 0;
                            const failsafe = 16;
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
                            const failsafe = 16;
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
                    komputerLog("Frigate recalled to port!");   
                }
            }
        }
    }
}


async function noRecall(thisGame, frigate)
{
    if (frigate.hasUnloadables() || hasAdjacentEnemyTown(thisGame, frigate.piece))
    {
        return true;
    }
    return await shouldGuardAdjacentCiv(thisGame, frigate);        
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
        targetPoint.score += hasAdjacentEnemyCivilization(thisGame, targetPiece) ? 0.25 : 0;
        targetPoint.score += hasAdjacentArmy(thisGame, targetPiece) ? 0.25 : 0;
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
                    komputerLog("Terrain not playable.");
                    return;
                }        
            };
            setTimeout(function(){
                // Maybe swap water hex for land.
                const waterPopup = document.getElementById("Foundation_Elemental_" + GameVersion + "_waterSwap");
                if (waterPopup)
                {
                    thisGame.swapWaterForLand();
                    komputerLog("Water swap!");
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
                            komputerLog("Done.");
                        }, 200);
                    }
                    // Player 2 places another town based on specific location data. Later reserve phases use other guidance.
                    else
                    {
                        if (thisGame.movePhase === 11)
                        {
                            if (thisGame.numberOfDistinctPlayers < 4)
                            {
                                let element = document.querySelector("#Foundation_Elemental_" + GameVersion + "_reserve_0");
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
                                        komputerLog("Done.");
                                    }
                                }
                                let destinationPiece = thisGame.pieces[pieceIndex];
                                destinationScreenPoint = destinationPiece.$screenRect.getCenter();
                                thisGame.placeReserveOnMouseUp(destinationScreenPoint);
                                playSound("buildCiv");
                                commitExploration(thisGame);
                                setTimeout(function(){
                                    const waterPopup = document.getElementById("Foundation_Elemental_" + GameVersion + "_waterSwap");
                                    if (waterPopup && !destinationPiece.isForest())
                                    {
                                        thisGame.swapWaterForLand();
                                        komputerLog("Water swap!");
                                    }
                                    setTimeout(function(){
                                        thisGame.customizeMapDoAll(true);
                                        element = document.querySelector("#Foundation_Elemental_" + GameVersion + "_reserve_0");
                                        thisGame.reserveOnMouseDown(element, thisGame.event("reserveOnMouseDown(this,event,#)"), 0);
                                        thisGame.placeReserveOnMouseUp( destinationScreenPoint );
                                        thisGame.endMyTurn();
                                        setTimeout(function(){
                                            window.isKomputerReady = true;
                                            resetKomputerButtonStyle();
                                            komputerLog("Done.");
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
    if (playerCount > 3 && playerCount !== 6)
    {
        if (playerCount === 8 && thisGame.perspectiveColor === 0)
        {
            return [findMaxYIndex(thisGame, pieceIndexChoices)];
        }
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


function findMaxYIndex(thisGame, pieceIndecies)
{
    let maxY = Number.MIN_VALUE;
    let maxIndex = Number.MIN_VALUE;
    for (const pieceIndex of pieceIndecies)
    {
        const piece = thisGame.pieces[pieceIndex];
        if (piece.boardPoint.y > maxY)
        {
            maxY = piece.boardPoint.y; 
            maxIndex = piece.index;
        }
    }
    return maxIndex;
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
    // Returns new hex order string based on received hexOrder and index.
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
    if (thisGame.maxMoveNumber > 8 || (window.isLargeBoard && thisGame.perspectiveColor !== 0))
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


function findAdjacentFriendlyCivs(thisGame, piece, color = null)
{
    if (color === null)
    {
        color = thisGame.perspectiveColor;
    }
    let adjacentCivs = [];
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        if (!adjacentPiece)
        {
            continue;
        }
        if (adjacentPiece.hasCivilization(color))
        {
            adjacentCivs.push(adjacentPiece);
        }
    }
    return adjacentCivs;
}


function countAdjacentFriendlyArmy(thisGame, piece, color = null)
{
    if (color === null)
    {
        color = thisGame.perspectiveColor;
    }
    let armyCount = 0;
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        if (!adjacentPiece)
        {
            continue;
        }
        for (const unit of adjacentPiece.units)
        {
            if (unit.color === color && ( unit.isInfantry() || unit.isArtillery() || unit.isCavalry() ))
            {
                armyCount++;
            }
        }        
    }
    return armyCount;
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


function countUnit(piece, type)
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
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        const hasSea = (adjacentPiece && adjacentPiece.boardValue === "w" && !adjacentPiece.hidden);
        if (hasSea)
        {
            count++;
        }
    }
    return count;
}

function countAdjacentHiddenTerrain(thisGame, piece)
{
    let hiddenCount = 0;
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        const isHidden =  (adjacentPiece && adjacentPiece.hidden);
        if (isHidden)
        {
            hiddenCount++;
        }
    }
    return hiddenCount;
}


function hasVerticalWaterway(thisGame, piece)
{
    let adjacentPiece;
    const hasBackwardWaterway = ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden);
    const hasForwardWaterway = ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.isWater() && !adjacentPiece.hidden);
    return hasForwardWaterway && hasBackwardWaterway;
}


function isAccessibleNow(piece, unit, viaCargo = false, allowFrigateBattle = true)
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
                    if (allowFrigateBattle)
                    {
                        return true;
                    }
                    else
                    {
                        const unloadingPiece = piece.pieces[point.retreatIndex];
                        const currentColor = piece.pieces.game.perspectiveColor;
                        if (!unloadingPiece.hasOpponentUnit(currentColor, "f"))
                        {
                            return true;
                        }
                    }
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


function findAdjacentFrigateBattle(thisGame, piece)
{
    const anyColor = -1;
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) && adjacentPiece.hasFrigate(anyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) && adjacentPiece.hasFrigate(anyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) && adjacentPiece.hasFrigate(anyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) && adjacentPiece.hasFrigate(anyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) && adjacentPiece.hasFrigate(anyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor) && adjacentPiece.hasFrigate(anyColor)) ? adjacentPiece : null;    
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


function hasAdjacentArmy(thisGame, piece, color)
{
    if (typeof(color) === "undefined")
    {
        color = thisGame.perspectiveColor;
    } 
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
            thisGame.setTargetPoints(getFrigateMovables(unit), false);
        }
        else
        {
            thisGame.setTargetPoints(getKomputerMovables(unit), false);  // unit.getMovables()
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
                    clearMoveIntervals();
                    clearMovementFlags();
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


// Modified original to get all visible moves, regardless of adjacent hidden terrain.
function getKomputerMovables(unit, forUndarkness)
{
   var movables=new Array();
   var allowance=unit.movementAllowance-unit.spacesMoved;
   unit.piece.pieces.setRecursionFlag("bestAllowance",-1);
   if (unit.isFrigate())
   {
      if (!unit.movementComplete)
         addKomputerFrigateMovables(unit, movables,unit.piece.boardPoint.x,unit.piece.boardPoint.y,allowance,0,false,-1);
      if (!forUndarkness && unit.hasUnloadables())
         unit.addUnloadMoveables(movables);
   }
   else
   {
      addKomputerLandMovables(unit, movables,unit.piece.boardPoint.x,unit.piece.boardPoint.y,allowance,0,-1);
      if (!forUndarkness && unit.spacesMoved==0)
         unit.addTransportMoveables(movables);
   }
   return movables.length>0 ? movables : null;
}


function isVisible(piece)
{
    return (piece.hidden === false);
}


function addKomputerLandMovables(unit, movables,x,y,allowance,distance,retreatIndex)
{
    var piece=unit.piece.pieces.findAtXY(x,y);
    if (piece && !piece.hidden && allowance>piece.bestAllowance && piece.isLand())
    {
        if (distance>0)
        piece.pushMoveable(movables,unit.color,unit.rulerColor,distance,retreatIndex);
        retreatIndex=piece.index;
        piece.bestAllowance=allowance;
        if (allowance>0 && isVisible(piece) &&
            !piece.hasRollingEnemy(unit.color,unit.rulerColor) &&
            (distance==0 || unit.ignoresSlowTerrain() || !piece.isSlowTerrain(unit.color,unit.rulerColor)))
        {
        allowance--;
        distance++;
        var roads=piece.getRoadsOut(unit.color,unit.rulerColor,allowance);
        for (var i=0;i<roads.length;i++)
            addKomputerLandMovables(unit, movables,roads[i].x,roads[i].y,allowance,distance,retreatIndex);
        addKomputerLandMovables(unit, movables,x-1,y,allowance,distance,retreatIndex);
        addKomputerLandMovables(unit, movables,x+1,y,allowance,distance,retreatIndex);
        addKomputerLandMovables(unit, movables,x,y-1,allowance,distance,retreatIndex);
        addKomputerLandMovables(unit, movables,x,y+1,allowance,distance,retreatIndex);
        addKomputerLandMovables(unit, movables,x-1,y-1,allowance,distance,retreatIndex);
        addKomputerLandMovables(unit, movables,x+1,y+1,allowance,distance,retreatIndex);
        }
    }
} 


function addKomputerFrigateMovables(unit, movables,x,y,allowance,distance,lastWasLand,retreatIndex)
{
    {
        var piece=unit.piece.pieces.findAtXY(x,y);
        if (piece && !piece.hidden && allowance>piece.bestAllowance)
        {
           if (piece.isLand())
           {
              if (lastWasLand || !piece.isPort(unit.color))
                 return;
              lastWasLand=true;
           }
           else
           {
              if (distance>0)
                 piece.pushMoveable(movables,unit.color,unit.rulerColor,distance,retreatIndex);
              lastWasLand=false;
              retreatIndex=piece.index;
           }
           retreatIndex=piece.index;
           piece.bestAllowance=allowance;
           if (allowance>0 && isVisible(piece) &&
               !piece.hasRollingEnemy(unit.color,unit.rulerColor))
           {
              allowance--;
              distance++;
              addKomputerFrigateMovables(unit, movables,x-1,y,allowance,distance,lastWasLand,retreatIndex);
              addKomputerFrigateMovables(unit, movables,x+1,y,allowance,distance,lastWasLand,retreatIndex);
              addKomputerFrigateMovables(unit, movables,x,y-1,allowance,distance,lastWasLand,retreatIndex);
              addKomputerFrigateMovables(unit, movables,x,y+1,allowance,distance,lastWasLand,retreatIndex);
              addKomputerFrigateMovables(unit, movables,x-1,y-1,allowance,distance,lastWasLand,retreatIndex);
              addKomputerFrigateMovables(unit, movables,x+1,y+1,allowance,distance,lastWasLand,retreatIndex);
           }
        }
     }
}


function patchUnitPrototype()
{
    // Patch adds a check for null before accessing each element. 
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

    GamesByEmail.Viktory2Piece.prototype.moveUnit = function(unit)
    {
        unit.piece.removeUnit(unit);
        unit.piece=this;
        if (!unit.movementComplete || this.hasEnemy(unit.color,unit.rulerColor))
        {
            for (var i=this.units.length;i>0;i--)
                (this.units[i]=this.units[i-1]).index=i;
            (this.units[0]=unit).index=0;
        }
        else
        {
            unit.index=this.units.length;
            this.units.push(unit);
        }
        if (!unit.movementComplete && !unit.piece.hasEnemy(unit.color, unit.rulerColor))
        {
            window.lastMovedUnit = unit;
        }
    }
}


// Keep the board vertical regardless of the current player color.
function patchPerspective(thisGame)
{
    const targetPrefix = "boardResourceName";
    for (let key in thisGame.constructor.resourcePack)
    {
        if (key.substring(0,targetPrefix.length) === targetPrefix)
        {        
            if (thisGame.constructor.resourcePack[key].includes("H"))
            {
                thisGame.constructor.resourcePack[key] = thisGame.constructor.resourcePack[key].substring(0,thisGame.constructor.resourcePack[key].length-1) + "V";
            }
        }
    }
}


// Performance boost, especially on large maps.
// Use hashmaps to look up pieces and distances by point coordinates.
function patchPieceData(thisGame)
{
    if (!shouldPatchPieceData(thisGame))
    {
        return;
    }
    window.cachePiecesLength = thisGame.pieces.length;
    patchPieceFinder(thisGame);
    patchDistanceMap(thisGame);
}


function patchPieceFinder(thisGame)
{
    window.pieceMap = new Map();
    const maxActivePieceIndex = thisGame.pieces.length - 1;
    for (let i = 0; i < maxActivePieceIndex; i++)
    {
        const piece = thisGame.pieces[i];
        const key = piece.boardPoint.x + '' + piece.boardPoint.y;
        window.pieceMap.set(key, piece.index)
    }
    thisGame.pieces.findAtXY = function(x,y)
    {
        const key = x + '' + y;
        if (!window.pieceMap.has(key))
        {
            return null;
        } 
        const pieceIndex = window.pieceMap.get(key);
        return this[pieceIndex];
    }
}


function patchDistanceMap(thisGame)
{
    window.distanceMap = new Map();
    thisGame.distanceBewteenPoints = function(p1,p2)
    {
        const key = [p1.x, p1.y, p2.x, p2.y].join('');  
        if (!window.distanceMap.has(key))
        {
            const distance = GamesByEmail.Viktory2Game.prototype.distanceBewteenPoints(p1, p2);
            window.distanceMap.set(key, distance);
            return distance;
        } 
        return window.distanceMap.get(key);
    }
}


function shouldPatchPieceData(thisGame)
{
    if (!window.pieceMap || !window.distanceMap || !window.cachePiecesLength)
    {
        return true;
    }
    return window.cachePiecesLength !== thisGame.pieces.length;
}


// Patch shows or hides Komputer controls and styles for dark mode depending on the active tab.
// Overwrites original codebase functions.
function patchControls()
{
    if (!GamesByEmail.Controls)
    {
        return;
    }
    GamesByEmail.Controls.StartGameStartTab.prototype.bringToFront = function(event, bringTitleIntoView)
    {
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        hideKomputerControls();
    }

    GamesByEmail.Controls.StartGameJoinTab.prototype.bringToFront = function(event, bringTitleIntoView)
    {
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        hideKomputerControls();
    }

    GamesByEmail.Controls.StartGamePreviewTab.prototype.bringToFront = function(event, bringTitleIntoView)
    {
        const darkModeToggle = document.getElementById("DarkModeToggle_" + GameVersion);
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        stylePage(darkModeToggle.checked, false);
        setTimeout(function(){ 
            let thisGame = findGameForActiveTab();
            verifyElementalIds(thisGame);
            showKomputerControls();
        }, 128);
    }
    
    GamesByEmail.Controls.StartGameTabSet.Tab.prototype.bringToFront = function(event,bringTitleIntoView)
    {
        hideKomputerControls();
        this.parent.bringTabToFront(this,event,bringTitleIntoView);
        const intervalId = setInterval(function()
        { 
            const thisGame = findGameForActiveTab();
            const hasElementalIds = verifyElementalIds(thisGame);
            if (!hasElementalIds)
            {
                return;
            }
            const success = showKomputerControls(); 
            if (!success)
            {
                return;
            }
            clearInterval(intervalId);
        }, 128);
    }
}


function hideKomputerControls()
{
    const darkModeToggle = document.getElementById("DarkModeToggle_" + GameVersion);
    if (!darkModeToggle)
    {
        return;
    }
    const visible = false;
    stylePage(darkModeToggle.checked, visible);
}


function showKomputerControls()
{
    const darkModeToggle = document.getElementById("DarkModeToggle_" + GameVersion);
    if (!darkModeToggle)
    {
        return false;
    }
    stylePage(darkModeToggle.checked);
    resetAllButtonStyles();
    return true;
}


// Overwrites original codebase functions.
function patchGamePrototype()
{
    // Adds check for objects before accessing.
    GamesByEmail.Viktory2Game.prototype.redeployUnitsMouseUp = function(screenPoint)
    {
        this.onMouseMove=null;
        this.onLeftMouseUp=null;
        let boardPoint=this.boardPointFromScreenPoint(this.constrainPoint(screenPoint));
        let movingPiece=this.pieces.getNewPiece();
        if (!boardPoint || !movingPiece || !movingPiece.movingUnit)
        {
            return false;
        }
        let movingUnit=movingPiece.movingUnit;
        let oldPiece=movingPiece.movingUnit.piece;
        if (this.isTargetPoint(boardPoint) && !boardPoint.equals(oldPiece.boardPoint))
        {
           this.readyToSend=false;
           let log;
           let target=this.pieces.findAtPoint(boardPoint);
           if (movingUnit.isFrigate())
           {
              let civ=this.pieces.findAtPoint(this.getTargetPlaceHolderPoint(boardPoint)).findCivilization(movingUnit.color);
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
              let civ=target.findCivilization(movingUnit.color);
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
              let log=this.logEntry(25,oldPiece.index,oldPiece.boardValue,movingUnit.color,movingUnit.type)+log;
              if (movingUnit.isFrigate() &&
                  movingUnit.cargo.length>0)
                 log+=this.logEntry(26,oldPiece.index,oldPiece.boardValue,movingUnit.color,movingUnit.cargo);
              movingUnit.remove(true);
              movingPiece.setMovingUnit(null);
              let nltd=this.nothingLeftToDo();
              this.pushMove("Redeploy",log,oldPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
              this.update();
           }
           else
           {
              let civ=oldPiece.findCivilization(movingUnit.color);
              if (civ)
                 civ.tookReserveUnit(movingUnit.type);
              movingUnit.setVisibility(true);
              movingPiece.setMovingUnit(null);
           }
        }
        return true;
    }

    // Modified to allow optional border visual when setting target points.
    GamesByEmail.Viktory2Game.prototype.setTargetPoints = function (points, shouldSetBorder = true)
    {
        this.targetPoints=points;
        this.targetPointsAllLand=true;
        if (this.pieces)
        {
           this.pieces.clearBorders();
           if (this.targetPoints)
              for (var i=0;i<this.targetPoints.length;i++)
                 if (!this.targetPoints[i].placeHolderOnly)
                 {
                    var p=this.pieces.findAtPoint(this.targetPoints[i]);
                    if (shouldSetBorder)
                    {
                        p.setBorder(true);
                    }
                    if (!p.isLand())
                       this.targetPointsAllLand=false;
                 }
        }
        if (!this.targetPoints || this.targetPoints.length==0)
           this.targetPointsAllLand=false;
        return this.targetPoints && this.targetPoints.length>0;
    }

    // Modified to play sound on placing capital.
    GamesByEmail.Viktory2Game.prototype.placeCapitalMouseDown = function(screenPoint)
    {
       this.maybeResetReservesByMouseUp();
       this.maybeHideOverlay();
       var point=this.boardPointFromScreenPoint(screenPoint);
       if (this.isTargetPoint(point))
       {
          playSound("buildCiv");
          var movingPiece=this.pieces.getNewPiece();
          movingPiece.setMovingUnit(null);
          var piece=this.pieces.findAtPoint(point);
          piece.addUnit(this.player.team.color,"C");
          piece.addUnit(this.player.team.color,"t");
          piece.addUnit(this.player.team.color,"i");
          piece.updateUnitDisplay();
          this.setTargetPoints(null);
          this.pushMove("Place Capital",this.logEntry(4,piece.index,piece.boardValue,"C","t","i"),piece,"processPlaceCapitalMove",true);
       }
       this.update();
    }

    // Modified to play sound on map customization.
    GamesByEmail.Viktory2Game.prototype.customizeMapOnMouseUp = function(screenPoint)
    {
       this.onMouseMove=null;
       this.onMouseUp=null;
       var movingPiece=this.pieces.getNewPiece();
       movingPiece.setVisibility(true);
       var boardPoint=this.boardPointFromScreenPoint(screenPoint=this.constrainPoint(screenPoint));
       var targetPiece=this.pieces.findAtPoint(boardPoint);
       if (targetPiece && targetPiece.boardValue=="l")
       {
          playSound("customizeMap");  
          targetPiece.setValue(movingPiece.value);
          this.maybeUndarkPiece(targetPiece);
          var origNum=this.getNumMapCustomizations();
          this.removeMapCustomizationDataValue(movingPiece.value);
          this.pushMapCustomizationMove(targetPiece,[targetPiece.index,movingPiece.value],origNum);
       }
       this.update();
    }

    // Modified to play sound on bombard.
    GamesByEmail.Viktory2Game.prototype.processBombardUnitMove = function(piece)
    {
       this.maybeReleaseFromVassalage(piece);
       var movingPiece=this.pieces.getNewPiece();
       movingPiece.setVisibility(true);
       movingPiece.setMovingUnit(null);
       if (window.isKomputerReady)
       {
            playSound("bombard_" + this.bombardingUnit.type);
       }
       this.bombardingUnit.setHilite(false);
       this.bombardingUnit.hasBombarded=true;
       this.bombardingUnit.noBombard=true;
       this.bombardingUnit.movementComplete=true;
       this.bombardingUnit.piece.updateUnitDisplay();
       this.setTargetPoints(null);
       var attackerRolls=[this.dieRoll()];
       var hits=this.countHitsForLog(attackerRolls,this.getHitThreshold(this.player.team.color));
       this.addAdditionalLogEntry(this.logEntry(50+hits.offset,this.player.team.color,1,hits.tactical,hits.nonTactical,hits.missed,hits.suppressed,attackerRolls.length,attackerRolls,hits.threshold));
       this.setBattleData(piece,-1,attackerRolls[0]);
    }

   // Modified to play sound on moving unit.
   GamesByEmail.Viktory2Game.prototype.moveUnitsMouseUp = function(screenPoint)
   {
      this.onMouseMove=null;
      this.onLeftMouseUp=null;
      if (this.lastLoadableUnit)
      {
         this.lastLoadableUnit.setHilite(false);
         this.lastLoadableUnit=null;
      }
      var movingPiece=this.pieces.getNewPiece();
      var boardPoint=this.boardPointFromScreenPoint(screenPoint=this.constrainPoint(screenPoint));
      if (this.isTargetPoint(boardPoint))
      {
         playSound("move_" + movingPiece.movingUnit.type);
         window.lastTargetPoint = boardPoint;
         var targetPiece=this.pieces.findAtPoint(boardPoint);
         if (movingPiece.movingUnit.isLandUnit() &&
             targetPiece.isWater())
         {
            var oldPiece=movingPiece.movingUnit.piece;
            var loadableUnit=this.militaryUnitFromScreenPoint(screenPoint,null,movingPiece.movingUnit.color,movingPiece.movingUnit.rulerColor,false,false,true);
            var log=this.logEntry(7,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.type,loadableUnit.type);
            loadableUnit.loadCargo(movingPiece.movingUnit);
            movingPiece.setMovingUnit(null);
            oldPiece.updateUnitDisplay();
            loadableUnit.piece.updateUnitDisplay();
            this.setTargetPoints(null);
            var nltd=this.nothingLeftToDo();
            this.pushMove("Load",log,targetPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
         }
         else
            if (movingPiece.movingUnit.isFrigate() &&
                targetPiece.isLand())
            {
               let oldPiece=movingPiece.movingUnit.piece;
               let log=this.logEntry(8,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.getActiveCargoType(),movingPiece.movingUnit.type);
               movingPiece.movingUnit.unloadCargo(targetPiece);
               movingPiece.movingUnit.piece.updateUnitDisplay();
               movingPiece.setMovingUnit(null);
               targetPiece.updateUnitDisplay();
               this.setTargetPoints(null);
               let nltd=this.nothingLeftToDo();
               this.pushMove("Unload",log,targetPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
            }
            else
            {
               let oldPiece=movingPiece.movingUnit.piece;
               let tp=this.getTargetPoint(boardPoint);
               let log=this.logEntry(9,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.type,tp.spacesNeeded);
               movingPiece.movingUnit.moveTo(targetPiece,tp.spacesNeeded,tp.retreatIndex);
               movingPiece.setMovingUnit(null);
               oldPiece.updateUnitDisplay();
               targetPiece.updateUnitDisplay();
               this.setTargetPoints(null);
               let nltd=this.nothingLeftToDo();
               this.pushMove("Move",log,targetPiece,"processMoveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
            }
      }
      else
      {
         this.setTargetPoints(null);
         this.onLeftMouseUp=null;
         this.onMouseMove="moveBombardUnitsMouseMove";
         this.onMouseOver="moveBombardUnitsMouseMove";
         this.onMouseOut="moveBombardUnitsMouseOut";
         movingPiece.movingUnit.setVisibility(true);
         var piece=movingPiece.movingUnit.piece;
         movingPiece.setMovingUnit(null);
         if (piece.boardPoint.equals(boardPoint) &&
             piece.hasBattle(this.player.team.color,this.player.team.rulerColor))
         {
            piece.setBorder(true);
            this.battleIndex=piece.index;
            this.pushMove("Battle",this.logEntry(6,piece.index,piece.boardValue,piece.getOpponentColor(this.player.team.color)),piece,piece.hasPreBattle(this.player.team.color) ? "processPreBattleMove" : "processStartBattleMove",true,"beginBattle","cancel");
         }
      }
      this.update();
   }

   // Modified to play sound on placing reserves.
   GamesByEmail.Viktory2Game.prototype.placeReserveOnMouseUp = function(screenPoint)
   {
      this.showReserveMessage();
      let e=this.getElement("mouse");
      if (e.releaseCapture)
         e.releaseCapture();
      let boardPoint=screenPoint ? this.boardPointFromScreenPoint(this.constrainPoint(screenPoint)) : null;
      let movingPiece=this.pieces.getNewPiece();
      let movingUnit=movingPiece.movingUnit;
      movingPiece.setMovingUnit(null);
      this.onMouseMove=null;
      this.onMouseUp=null;
      if (this.isTargetPoint(boardPoint))
      {
        if (movingUnit.isMilitary(movingUnit.color))
        {
            playSound("place_" + movingUnit.type);
        }
        else
        {
            playSound("buildCiv");
        }
         if (this.movePhase<6)
            this.pieces.setAllMilitaryMoveComplete(movingUnit.color,true);
         let target=this.pieces.findAtPoint(boardPoint);
         let log;
         if (movingUnit.isTown())
         {
            let targetCiv=target.findCivilization(movingUnit.color);
            if (targetCiv)
            {
               targetCiv.upgradeToCity();
               log=this.logEntry(24,target.index,target.boardValue,movingUnit.color,movingUnit.type,targetCiv.type);
            }
            else
            {
               movingUnit=target.addUnit(movingUnit.color,movingUnit.type);
               log=this.logEntry(23,target.index,target.boardValue,movingUnit.color,movingUnit.type);
            }
            this.player.team.reserveUnits=this.getReserveUnitTypes(this.player.team.color);
         }
         else
         {
            movingUnit=target.addUnit(movingUnit.color,movingUnit.type);
            movingUnit.movementComplete=true;
            this.player.team.reserveUnits=this.player.team.reserveUnits.substr(0,this.movingReserveIndex)+this.player.team.reserveUnits.substr(this.movingReserveIndex+1);
         }
         target.updateUnitDisplay();
         if (movingUnit.isFrigate())
         {
            let civ=this.pieces.findAtPoint(this.getTargetPlaceHolderPoint(boardPoint)).findCivilization(movingUnit.color);
            civ.tookReserveUnit(movingUnit.type);
            log=this.logEntry(22,civ.piece.index,civ.piece.boardValue,civ.color,civ.type,movingUnit.type,target.index,target.boardValue);
         }
         else
            if (!movingUnit.isTown())
            {
               let civ=target.findCivilization(movingUnit.color);
               civ.tookReserveUnit(movingUnit.type);
               log=this.logEntry(21,civ.piece.index,civ.piece.boardValue,civ.color,civ.type,movingUnit.type);
            }
         this.setTargetPoints(null);
         if (this.movePhase==5)
            this.movePhase=11;
         let nltd=this.nothingLeftToDo(true);
         this.pushMove("Place Reserve",log,target,"processPlaceReserveUnitMove",nltd,nltd ? "commitEndOfTurn" : null);
      }
      else
      {
         this.setTargetPoints(null);
         if (this.movingReserveIndex>=-1)
            this.getElement("reserve_"+this.movingReserveIndex).style.visibility="visible";
      }
      this.update();
   }

   // Modified to play sound on check for battles pending.
   GamesByEmail.Viktory2Game.prototype.anyMovesOrBattlesLeft = function()
   {
    if (window.isKomputerReady)
    {
        let thisGame = this;
        setTimeout(function()
        {
            if (thisGame.hasBattlesPending)
            {
                const lastTargetPiece = thisGame.pieces.findAtPoint(window.lastTargetPoint);
                if (lastTargetPiece.hasBattle(thisGame.player.team.color,thisGame.player.team.rulerColor))
                {
                    playSound("battlePending");
                    if (lastTargetPiece.hasOpponentCivilization(thisGame.perspectiveColor))
                    {
                        playSound("battleCiv");
                    }
                }
            }
        }, 600);
    }
    return (this.hasBattlesPending ||
              (this.movePhase==5 &&
               (this.pieces.anyMoversLeft(this.player.team.color) ||
                this.pieces.anyBombardersLeft(this.player.team.color))));
   }

   // Modified to play sound on pre-battle artillery.
   GamesByEmail.Viktory2Game.prototype.processPreBattleMove = function(piece)
   {
      this.maybeReleaseFromVassalage(piece);
      let opponentColor=piece.getOpponentColor(this.player.team.color);
      piece.addUnit(opponentColor,"p");
      this.setTargetPoints(null);
      let numAttackerGuns=piece.getArtilleryUnitList(this.player.team.color).length;
      let numDefenderGuns=this.playOptions.defendingArtilleryPrefire ? piece.getArtilleryUnitList(opponentColor).length : 0;
      let attackerRolls=numAttackerGuns>0 ? this.diceRolls(numAttackerGuns) : null;
      let defenderRolls=numDefenderGuns>0 ? this.diceRolls(numDefenderGuns) : null;
      this.addAdditionalLogEntry(this.logEntry(12,piece.index,piece.boardValue,numAttackerGuns,opponentColor,numDefenderGuns));
      if (attackerRolls)
      {
         let hits=this.countHitsForLog(attackerRolls,this.getHitThreshold(this.player.team.color));
         this.addAdditionalLogEntry(this.logEntry(50+hits.offset,this.player.team.color,numAttackerGuns,hits.tactical,hits.nonTactical,hits.missed,hits.suppressed,attackerRolls.length,attackerRolls,hits.threshold));
      }
      if (defenderRolls)
      {
         let hits=this.countHitsForLog(defenderRolls,this.getHitThreshold(opponentColor));
         this.addAdditionalLogEntry(this.logEntry(60+hits.offset,opponentColor,numDefenderGuns,hits.tactical,hits.nonTactical,hits.missed,hits.suppressed,defenderRolls.length,defenderRolls,hits.threshold));
      }
      this.setBattleData(piece,0,attackerRolls,defenderRolls,piece.collectRetreatIndices(this.player.team.color));
      if (attackerRolls || defenderRolls)
      {
        if (window.isKomputerReady)
        {
            playSound("battleRoll");
            const anyColor = -1;
            if (piece.hasCavalry(anyColor))
            {
                playSound("battleCavalry");
            }
            if (piece.hasArtillery(anyColor) || piece.hasFrigate(anyColor))
            {
                playSound("battleArtillery");
            }
        }
      }
   }

   // Modified to play sound on battle start.
   GamesByEmail.Viktory2Game.prototype.processStartBattleMove = function(piece)
   {
      this.maybeReleaseFromVassalage(piece);
      this.processContinueBattleMove(piece,piece.collectRetreatIndices(this.player.team.color),true);
    if (window.isKomputerReady)
    {
        playSound("battleRollShort");
        const anyColor = -1;
        if (piece.hasCavalry(anyColor))
        {
            playSound("battleCavalry");
        }
        if (piece.hasArtillery(anyColor) || piece.hasFrigate(anyColor))
        {
            playSound("battleArtillery");
        }
    }
   }

   // Modified to play sound on battle continue.
   GamesByEmail.Viktory2Game.prototype.processContinueBattleMove = function(piece,retreatIndices,startingBattle)
   {
    if (window.isKomputerReady)
    {
        playSound("battleRollShort");
        const anyColor = -1;
        if (piece.hasCavalry(anyColor))
        {
            playSound("battleCavalry");
        }
        if (piece.hasArtillery(anyColor) || piece.hasFrigate(anyColor))
        {
            playSound("battleArtillery");
        }
    }
    if (!retreatIndices)
        retreatIndices=piece.retreatIndices;
    var opponentColor=piece.getOpponentColor(this.player.team.color);
    if (this.movePhase!=9 &&
        !piece.hasOpponentPennant(this.player.team.color))
        piece.addUnit(opponentColor,"p");
    var rolls=piece.getRolls(this.player.team.color);
    
    var rollingAttackers=piece.countRollingUnits(this.player.team.color);
    var rollingDefenders=piece.countRollingUnits(opponentColor);
    this.addAdditionalLogEntry(this.logEntry(startingBattle ? 13 : 14,piece.index,piece.boardValue,rollingAttackers,opponentColor,rollingDefenders));
    
    var attackerHits=rolls.attacker.length>0 ? this.countHitsForLog(rolls.attacker,rolls.attackerHitThreshold) : null;
    var defenderHits=rolls.defender.length>0 ? this.countHitsForLog(rolls.defender,rolls.defenderHitThreshold,attackerHits) : null;
    
    if (attackerHits)
        this.addAdditionalLogEntry(this.logEntry(50+attackerHits.offset,this.player.team.color,rollingAttackers,attackerHits.tactical,attackerHits.nonTactical,attackerHits.missed,attackerHits.suppressed,rolls.attacker.length,rolls.attacker,attackerHits.threshold));
    if (defenderHits)
        this.addAdditionalLogEntry(this.logEntry(60+defenderHits.offset,opponentColor,rollingDefenders,defenderHits.tactical,defenderHits.nonTactical,defenderHits.missed,defenderHits.suppressed,rolls.defender.length,rolls.defender,defenderHits.threshold));
    this.setBattleData(piece,1,rolls.attacker,rolls.defender,retreatIndices);
   }

   // Modified to play sound on win.
   GamesByEmail.Viktory2Game.prototype.checkForWin = function(committing)
   {
      let possibleWinner;
      for (let i=0;i<this.teams.length;i++)
         if (this.teams[i].status.inPlay &&
             !this.teams[i].status.resigned &&
             this.teams[i].rulerColor<0)
         {
            possibleWinner=this.teams[i];
            break;
         }
      let anyOtherStanding=false;
      for (let i=0;i<this.teams.length;i++)
         if (i!=possibleWinner.index &&
             this.teams[i].status.inPlay &&
             !this.teams[i].status.resigned &&
             this.teams[i].rulerColor!=possibleWinner.color)
         {
            anyOtherStanding=true;
            break;
         }
      if (!anyOtherStanding)
      {
         if (committing)
        {
            this.setEnded(possibleWinner);
            if (window.isKomputerReady)
            {
                playSound("win");
                komputerLog("Viktory.");
                setTimeout(function(){ resetKomputerButtonStyle(true) }, 200);
            }
        }
         return true;
      }
      return false;
   }

   // Modified to play sound on losing a capital.
   GamesByEmail.Viktory2Game.prototype.processBattleCompleteMove = function(piece)
   {
    if (piece)
    {
        if (window.isKomputerReady)
        {
            const opponentCapital = piece.findOpponentCapital(this.perspectiveColor);
            if (opponentCapital)
            {
                // Play sound when game is not won and a player loses the capital. 
                if (!this.checkForWin(false) && !this.doesColorControlTheirCapital(opponentCapital.color))
                {
                    playSound("lose");
                }
            }
        }
    }
      if (!this.checkForWin(true) &&
          this.movePhase==12 &&
          !this.hasBattlesPending)
         return this.moveToNextPlayer();
      return true;
   }

   // End patch for GamesByEmail.Viktory2Game.prototype.
}


function styleGameMessageBox(thisGame)
{
    if (!thisGame.previewing)
    {
        let messageReadBox = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageRead");
        let messageWriteBox = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite");
        if (messageReadBox && messageWriteBox)
        {
            messageReadBox.style.height = 164;
            messageWriteBox.style.height = 72;
        }
    }
}


function addRunButton(text, onclick, pointerToGame) {
    let style = {position: 'absolute', top: getRunButtonTop(), left:'24px', 'z-index': '9999', "-webkit-transition-duration": "0.6s", "transition-duration": "0.6s", overflow: 'hidden', width: '128px', 'font-size': '10px'}
    let button = document.createElement('button'), btnStyle = button.style
    document.body.appendChild(button) // For now, this works well enough, but it'd be best to add into GBE system.
    button.setAttribute("class", "button_runKomputer");
    button.innerText = text;
    button.id = "KomputerButton_" + GameVersion;
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
    let style = {position: 'absolute', top: getStopButtonTop(), left:'24px', 'z-index': '9999', "-webkit-transition-duration": "0.2s", "transition-duration": "0.2s", overflow: 'hidden', width: '64px', 'font-size': '10px'}
    let button = document.createElement('button'), btnStyle = button.style
    document.body.appendChild(button) // For now, this works well enough.
    button.setAttribute("class", "button_stopKomputer");
    button.id = "StopKomputerButton_" + GameVersion;
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
    toggle.id = "DarkModeToggle_" + GameVersion;
    toggle.checked = window.cacheDarkMode ? window.cacheDarkMode : false;
    toggle.addEventListener('click', function(){
        komputerLog("Dark Mode: " + this.checked);
        stylePage(this.checked);
    });
	let style = {position: 'absolute', top: getDarkModeToggleTop(), left:'88px', 'z-index': '9999'}; 
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    document.body.appendChild(toggle);
    // Toggle Label
    let toggleLabel = document.createElement("label");
    toggleLabel.id = "DarkModeLabel_" + GameVersion;
    toggleLabel.htmlFor = "DarkModeToggle_" + GameVersion;
    toggleLabel.innerText = "Dark";  
    style = {position: 'absolute', top: getDarkModeToggleLabelTop(), left:'107px', 'z-index': '9999', 'font-size': '8px'};
    Object.keys(style).forEach(key => toggleLabel.style[key] = style[key]);
    document.body.appendChild(toggleLabel);
}


function getRunButtonTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 'px');
}

function getStopButtonTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 20 + 'px');
}


function getDarkModeToggleTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 18 + 'px');
}


function getDarkModeToggleLabelTop()
{
    return (window.scrollY + document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles').getBoundingClientRect().top + 22 + 'px');
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
    clearHoldingUnits();
    resetGlobals(resetKomputerButton);
    komputerLog("Stopped.");
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
    let button = document.getElementById("StopKomputerButton_" + GameVersion);
    button.style.backgroundColor = 'lightpink';
    button.style.color = 'crimson';
    button.innerText = "Stopping";
    resetButtonPositions();
}


function styleButtonForRun()
{
    let button = document.getElementById("KomputerButton_" + GameVersion);
    button.style.backgroundColor = 'mediumseagreen';
    button.style.color = 'crimson';
    button.innerText = "Running";
    resetButtonPositions();
}


function resetKomputerButtonStyle(isGameWon = false, message = "Let Komputer Play")
{
    let button = document.getElementById("KomputerButton_" + GameVersion);
    button.style.backgroundColor = '';
    button.style.color = '';
    button.innerText = isGameWon ? "Viktory" : message;
    if (message === "Enemy Turn")
    {
        button.style.backgroundColor = 'lightsalmon';
    }
    resetButtonPositions();
}


function resetStopKomputerButtonStyle()
{
    let button = document.getElementById("StopKomputerButton_" + GameVersion);
    button.style.backgroundColor = '';
    button.style.color = '';
    button.innerText = "Stop";
    resetButtonPositions();
}


function resetButtonPositions(visible = true)
{
    let runButton = document.getElementById("KomputerButton_" + GameVersion);
    let stopButton = document.getElementById("StopKomputerButton_" + GameVersion);
    let darkModeToggle = document.getElementById("DarkModeToggle_" + GameVersion);
    let darkModeLabel = document.getElementById("DarkModeLabel_" + GameVersion);
    let boardBuilder = document.getElementById("BoardBuilder");
    let boardBuilderToggle = document.getElementById("BoardBuilderToggle");
    let multiplayerForm = document.getElementById("MultiplayerForm");
    let soundToggle = document.getElementById("SoundToggle_" + GameVersion);
    let soundToggleLabel = document.getElementById("SoundToggleLabel_" + GameVersion);
    if (visible)
    {
        runButton.style.top = getRunButtonTop();
        stopButton.style.top = getStopButtonTop();
        darkModeToggle.style.top = getDarkModeToggleTop();
        darkModeLabel.style.top = getDarkModeToggleLabelTop();
        soundToggle.style.top = getDarkModeToggleTop();
        soundToggleLabel.style.top = getDarkModeToggleLabelTop();
        runButton.style.visibility = ""; 
        stopButton.style.visibility = "";
        darkModeToggle.style.visibility = ""; 
        darkModeLabel.style.visibility = ""; 
        soundToggle.style.visibility = "";
        soundToggleLabel.style.visibility = "";
        if (isOnPreviewTab())
        {
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
                    boardBuilderToggle.labels[0].style.visibility = ""
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
            if (boardBuilderToggle.labels.length)
            {
                boardBuilderToggle.labels[0].style.visibility = "hidden";
            }
        }
        if (multiplayerForm)
        {
            multiplayerForm.style.visibility = "hidden";   
        }
        soundToggle.style.visibility = "hidden";
        soundToggleLabel.style.visibility = "hidden";
    }
}


function cacheElementsForStyling()
{
    if (hasGamesByEmailTabs())
    {
        const applyTempStyle = window.cacheDarkMode;
        if (applyTempStyle)
        {
            stylePage(false);
        }
        // Cache body and messages
        window.cacheElements = [
            document.getElementById("Foundation_Elemental_1_content").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageRead").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_playerNotes").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite").cloneNode(true)
        ];
        // Cache tab titles and spacers
        const queryPrefix = "#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(";
        const suffix = ")";
        for (let tabElementId = 1; document.querySelector(queryPrefix + tabElementId + suffix); tabElementId++)
        {
            window.cacheElements.push(document.querySelector(queryPrefix + tabElementId + suffix).cloneNode(true));
        }
        // Cache footer 
        const footer = document.querySelector("body > div:nth-child(3) > div:nth-child(6)").cloneNode(true);
        if (footer)
        {
            window.cacheElements.push(footer);
        }
        if (applyTempStyle)
        {
            stylePage(true);
        }
    }
    else
    {
        // Cache messages.
        window.cacheElements = [
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageRead").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_playerNotes").cloneNode(true),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite").cloneNode(true),
        ];
    }
}


function stylePage(isDarkMode, visibleButtons = true)
{
    resetButtonPositions(visibleButtons);
    let content = getDocumentContent(); 
    let footer = getDocumentFooter();
    if (isDarkMode)
    {
        window.cacheDarkMode = true;
        if(isNotDark(content, footer))
        {
            applyDarkMode(content, footer);
        }
    }
    else
    {
        window.cacheDarkMode = false;   
        if(isNotLight(content, footer))
        {
            applyLightMode(content, footer);
        }
    }
}


function isNotDark(content, footer)
{
    const contentIsNotDark = content.style.backgroundColor !== 'slategrey';
    const footerIsNotDark = footer ? footer.style.backgroundColor !== "grey" : null;
    return footer ? ( contentIsNotDark || footerIsNotDark ) : contentIsNotDark;
}


function isNotLight(content, footer)
{
    const contentIsNotLight = content.style.backgroundColor !== 'rgb(238, 238, 255)';
    const footerIsNotLight = footer ? footer.style.backgroundColor !== 'rgb(238, 238, 255)' : null;
    return footer ? (contentIsNotLight || footerIsNotLight) : contentIsNotLight; 
}


function applyDarkMode(content, footer)
{
    if (hasGamesByEmailTabs())
    {
        // Style body.
        document.body.style.backgroundColor = 'dimgrey';
        content.style.backgroundColor = 'slategrey';
        window.cacheContentBackgroundColor = content.style.backgroundColor;
        content.style.border = '2px solid slategrey';
        // Style tabs.
        const idPrefix = "Foundation_Elemental_1_title_";
        const tabs = GamesByEmail.Controls.StartGameTabSet.getFirst(true).tabs;
        for (const tab of tabs)
        {
            const tabElement = document.getElementById(idPrefix + tab.uid);
            tabElement.style.backgroundColor = tab.isInFront ? 'lightgrey' : 'grey';
            tabElement.style.border = '';
        }
        // Style borders.
        const queryPrefix = "#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(";
        const suffix = ")";
        for (let childNumber = 1; document.querySelector(queryPrefix + childNumber + suffix); childNumber++)
        {
            const element = document.querySelector(queryPrefix + childNumber + suffix);
            element.style.border = '';
        }
        // Style bottom div.
        if (footer)
        {
            footer.style.backgroundColor = 'grey';
            footer.style.border = '';
        }
    }
    else
    {
        // Style body
        content.style.backgroundColor = 'slategrey';
    }
    // Style messages.
    let gameMessageRead = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageRead");
    let playerNotes = document.getElementById("Foundation_Elemental_" + GameVersion + "_playerNotes");
    let gameMessageWrite = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite");
    gameMessageRead.style.backgroundColor = 'lightgrey';
    playerNotes.style.backgroundColor = 'lightgrey';
    gameMessageWrite.style.backgroundColor = 'lightgrey';
}


function applyLightMode(content, footer)
{
    document.body.style.backgroundColor = '';
    let pageElements = null;
    if (hasGamesByEmailTabs())
    {
        // Prep content, messages.
        pageElements = [
            content,
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageRead"),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_playerNotes"),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite")
        ]
        // Prep tabs.
        const queryPrefix = "#Foundation_Elemental_1_tabs > tbody > tr > td:nth-child(";
        const suffix = ")";
        for (let tabElement = 1; document.querySelector(queryPrefix + tabElement + suffix); tabElement++)
        {
            pageElements.push(document.querySelector(queryPrefix + tabElement + suffix));
        }
        // Prep footer.
        if (footer)
        {
            pageElements.push(footer);
        }
    }
    else
    {
        // Prep messages.
        pageElements = [
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageRead"),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_playerNotes"),
            document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite")
        ]
    }
    // Set all to cache values. 
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
    // Backup copy of content, for Board Builder or anything that might temporarily change backgroundColor.
    window.cacheContentBackgroundColor = content.style.backgroundColor;
}


function hideEndTurnButtons()
{
    let endMovementButton = document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyMovement");
    if (endMovementButton)
    {
        endMovementButton.disabled = true;
        endMovementButton.style.visibility = "hidden";
    }
    let endTurnButton = document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyTurn");
    if (endTurnButton)
    {
        endTurnButton.disabled = true;
        endTurnButton.style.visibility = "hidden";
    }
}


function showEndTurnButtons()
{
    let endMovementButton = document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyMovement");
    if (endMovementButton)
    {
        endMovementButton.disabled = false;
        endMovementButton.style.visibility = "visible";
    }
    let endTurnButton = document.getElementById("Foundation_Elemental_" + GameVersion + "_endMyTurn");
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
    const xOffset = document.getElementById("Foundation_Elemental_" + GameVersion + "_pieces").getBoundingClientRect().left + window.scrollX;
    const yOffset = document.getElementById("Foundation_Elemental_" + GameVersion + "_pieces").getBoundingClientRect().top + window.scrollY; 
    const screenPoint = new Foundation.Point(firstTouch.pageX - xOffset, firstTouch.pageY - yOffset);
    if (isInsideHitBox(firstTouch))
    {
        event.preventDefault();
        const thisGame = findGameForActiveTab(); 
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
        touch.pageX > window.touchHitBox.left && 
        touch.pageX < window.touchHitBox.right && 
        touch.pageY > window.touchHitBox.top && 
        touch.pageY < window.touchHitBox.bottom
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
    return document.querySelector("#Foundation_Elemental_" + GameVersion + "_overlayCommit");
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
    const mouseEventClientRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_mouseEventContainer').getBoundingClientRect();
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
            Object.keys(window.isTerrainSelected).forEach(key => { window.isTerrainSelected[key] = false; });
            window.isTerrainSelected[radioButton.value] = true;
            radioButton.checked = window.isTerrainSelected[radioButton.value] ? true : false; 
            komputerLog("Pressed: " + radioButton.value);
            enableBoardBuilder();
        }
    )
}


function getBoardBuilderTop()
{
    const playerNotesOffset = 14;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset + 'px');
}


function getBoardBuilderLeft()
{
    const playerNotesOffset = 200;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
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
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + boardBuilderTop + 'px');
}


function getBoardBuilderToggleLeft()
{
    const boardBuilderLeft = 272;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.3;
    return (window.scrollX + playerNotesMidwayX + boardBuilderLeft + 'px');
}


function getBoardBuilderToggleLabelTop()
{
    const boardBuilderTop = 17;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + boardBuilderTop + 'px');
}


function getBoardBuilderToggleLabelLeft()
{
    const boardBuilderLeft = 292;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.3;
    return (window.scrollX + playerNotesMidwayX + boardBuilderLeft + 'px');
}


function boardBuilderToggleMouseClick(event, toggle)
{
    toggle = event ? event.currentTarget : toggle;
    const thisGame = findGameForActiveTab(); 
    if (toggle.checked)
    {
        stopAndReset();
        if (thisGame.playOptions.mapCustomizationData.length > 0)
        {
            thisGame.customizeMapDoAll(true);
        }
        window.cacheMovePhase = thisGame.movePhase;
        thisGame.movePhase = -1;
        thisGame.update();
        document.addEventListener('mousedown', boardBuilderMouseDown);
        document.addEventListener('mousemove', boardBuilderMouseMove);
        document.addEventListener('mouseup', boardBuilderMouseUp);
        komputerLog("Board Builder: On");
        thisGame.maybeHideOverlay();
        maybeSelectDefaultTerrain();
        setTimeout(function(){}, 1)
        {
            const title = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameState");            
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
            const prompt = document.getElementById("Foundation_Elemental_" + GameVersion + "_gamePrompts");
            prompt.innerText = "Game is paused. Customize terrain on any hex, then switch off the Board Builder to resume play.";
        }
    }
    else
    {
        thisGame.movePhase = window.cacheMovePhase < 0 ? 0 : window.cacheMovePhase;
        const content = getDocumentContent();
        content.style.backgroundColor = window.cacheContentBackgroundColor;
        content.style.cursor = "auto";
        const title = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameState");  
        title.style.backgroundColor = "";
        document.removeEventListener('mousedown', boardBuilderMouseDown);
        document.removeEventListener('mousemove', boardBuilderMouseMove);
        document.removeEventListener('mouseup', boardBuilderMouseUp);
        komputerLog("Board Builder: Off");
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


function getDocumentFooter()
{
    const footer = document.querySelector("body > div:nth-child(3) > div:nth-child(6)");
    return footer ? footer : null;
}


function boardBuilderMouseDown(event)
{
    if (isBoardBuilderDisabled())
    {
        return; 
    }
    maybeSelectDefaultTerrain();
    const xOffset = document.getElementById("Foundation_Elemental_" + GameVersion + "_pieces").getBoundingClientRect().left + window.scrollX; 
    const yOffset = document.getElementById("Foundation_Elemental_" + GameVersion + "_pieces").getBoundingClientRect().top + window.scrollY; 
    const screenPoint = new Foundation.Point(event.pageX - xOffset, event.pageY - yOffset); 
    const thisGame = findGameForActiveTab(); ;
    let boardPoint = thisGame.boardPointFromScreenPoint(screenPoint);   
    let piece = thisGame.pieces.findAtPoint(boardPoint);
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
        for (let key in window.isTerrainSelected)
        {
            if (window.isTerrainSelected[key])
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


function boardBuilderMouseUp()
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
    if (thisGame.previewing && isOnPreviewTab())
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
            Object.keys(window.isPlayerCountSelected).forEach(key => { window.isPlayerCountSelected[key] = false; });
            window.isPlayerCountSelected[radioButton.value] = true;
            radioButton.checked = window.isPlayerCountSelected[radioButton.value] ? true : false; 
            komputerLog("Pressed: " + radioButton.value);
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
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset + 'px');
}


function getMultiplayerFormLeft()
{
    const playerNotesOffset = 174;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.4;
    return (window.scrollX + playerNotesMidwayX + playerNotesOffset + 'px');
}


function multiplayerRestartButtonMouseClick(thisGame)
{
    stopAndReset();
    disableBoardBuilder();
    expandMultiplayerForm();
    patchPerspective(thisGame); 
    const formIndex = Foundation.$registry.length - 1;
    const playButton = document.getElementById("Foundation_Elemental_" + formIndex + "_PlayButton");
    const startAnotherButton = document.getElementById("Foundation_Elemental_" + GameVersion + "_startAnotherGame");
    if (playButton)
    {
        playSound("newGame");  
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
        if (!isOnPreviewTab() || !document.getElementById("Foundation_Elemental_" + GameVersion + "_resign"))
        {
            thisGame.sendMove();
            setTimeout(function()
            {
                if (isOnPreviewTab() && document.getElementById("Foundation_Elemental_" + GameVersion + "_resign"))
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
        selectDefaultPlayerCount(); 
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
        playButton.style.visibility = "hidden";
        const cancelButton = document.getElementById("Foundation_Elemental_" + formIndex + "_CancelButton");
        cancelButton.style.visibility = "hidden";
    }
}


function selectDefaultPlayerCount()
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


function isLocationNew()
{
    if (!window.komputerLocations)
    {
        return true;
    }
    return (!window.komputerLocations.includes(window.location.href));
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


// Sound 


function addSound()
{
    if (!window.KomputerSoundPath)
    {
        komputerLog("Audio source not found.");
        return;
    }
    KomputerSound = {path : window.KomputerSoundPath, playList : new Map(), shouldPlay : false, debug : false}
    addSoundToggle();
}


function addSoundToggle()
{
    let toggle = document.createElement("input");
    toggle.setAttribute("type", "checkbox");
    toggle.id = "SoundToggle_" + GameVersion;
    toggle.addEventListener('click', function()
    {
        komputerLog("Sound Toggle: " + this.checked);
        resetButtonPositions();
        toggleSound(this.checked);
    });  
	let style = {position: 'absolute', top: getDarkModeToggleTop(), left:'124px', 'z-index': '9999'};
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    document.body.appendChild(toggle);
    // Toggle Label
    let toggleLabel = document.createElement("label");
    toggleLabel.id = "SoundToggleLabel_" + GameVersion;
    toggleLabel.htmlFor = "SoundToggle_" + GameVersion
    toggleLabel.innerText = "Sound";  
    style = {position: 'absolute', top: getDarkModeToggleLabelTop(), left:'143px', 'z-index': '9999', 'font-size': '8px'};
    Object.keys(style).forEach(key => toggleLabel.style[key] = style[key]);
    document.body.appendChild(toggleLabel);
}


function toggleSound(isChecked)
{
    if (!KomputerSound)
    {
        return;
    }
    KomputerSound.shouldPlay = isChecked;
    if (isChecked)
    {
        loadSounds();
    }
    else 
    {
        stopAllSound();
    }
}


function loadSounds(forceReload = false, playAmbient = true)
{
    if (!KomputerSound || !KomputerSound.shouldPlay)
    {
        return;
    }
    if (KomputerSound.playList.size === 0 || forceReload)
    {
        if (forceReload)
        {
            stopAllSound();
        }
        let eventTypes = ["ambient", "battleArtillery", "battleCavalry", "battleCiv", "battlePending", "battleRoll", "battleRollShort", "bombard_f", "bombard_a", "buildCiv", "customizeMap", "move_i", "move_c", "move_a", "move_f", "place_i", "place_c", "place_a", "place_f", "lose", "win", "newGame"];
        for (const type of eventTypes)
        {
            KomputerSound.playList.set(type, {audioHandles: getAudioHandles(type), playIndex: 0, noOverlap : cannotOverlap(type)});
        }
    }
    if (playAmbient)
    {
        setTimeout(function(){playSound("ambient")}, 200);
    }
}


function getAudioHandles(type)
{
    switch(type)
    {
        case "ambient" : 
        {
            return getAmbientAudio();
        }
        case "battleArtillery" : 
        {
            return getBattleArtilleryAudio();
        }
        case "battleCavalry" : 
        {
            return getBattleCavalryAudio();
        }
        case "battleCiv" : 
        {
            return getBattleCivAudio(); 
        }
        case "battlePending" : 
        {
            return getBattlePendingAudio(); 
        }
        case "battleRoll" : 
        {
            return getBattleRollAudio(); 
        }
        case "battleRollShort" : 
        {
            return getBattleRollShortAudio(); 
        }
        case "bombard_a":
        {
            return getArtilleryBombardAudio();
        }    
        case "bombard_f":
        {
            return getfrigateBombardAudio();
        }                 
        case "buildCiv" : 
        {
            return getBuildCivAudio(); 
        }
        case "customizeMap" :
        {
            return getCustomizeMapAudio();
        }
        case "place_i" : 
        {
            const numFiles = 9;
            return getPlaceReserveAudio(type, numFiles); 
        }
        case "place_c" : 
        {
            const numFiles = 3;
            return getPlaceReserveAudio(type, numFiles); 
        }
        case "place_a" : 
        {
            const numFiles = 3;
            return getPlaceReserveAudio(type, numFiles); 
        }
        case "place_f" : 
        {
            const numFiles = 3;
            return getPlaceReserveAudio(type, numFiles); 
        }
        case "move_i" : 
        {
            return getMoveInfantryAudio(); 
        }
        case "move_c" : 
        {
            return getMoveCavalryAudio(); 
        }
        case "move_a" : 
        {
            return getMoveArtilleryAudio(); 
        }
        case "move_f" : 
        {
            return getMoveFrigateAudio(); 
        }
        case "lose" : 
        {
            return getLoseAudio(); 
        }        
        case "win" : 
        {
            return getWinAudio(); 
        }
        case "newGame" :
        {
            return getNewGameAudio();
        }
        case "default" :
        {
            console.warning("No audio handles for unknown event: " + type)
            return [];
        }
    }
}


function cannotOverlap(type)
{
    switch(type)
    {
        case "battleCiv" :
        case "move_i" : 
        case "lose" :
        case "win" : 
        {
            return true; 
        }
        case "default" :
        {
            return false;
        }
    }
}


function playSound(eventType)
{
    if (!KomputerSound || !KomputerSound.shouldPlay)
    {
        return;
    }
    let audioHandle = null; 
    if (KomputerSound.playList.has(eventType))
    {
        const sound = KomputerSound.playList.get(eventType);
        const audioHandles = sound.audioHandles;
        if (audioHandles)
        {
            if (sound.noOverlap)
            {
                for (const audioHandle of sound.audioHandles)
                {
                    if (!audioHandle.paused)
                    {
                        return;
                    }
                }
            }
            const playIndex = sound.playIndex;
            audioHandle = audioHandles[playIndex];
            incrementPlayIndex(sound);
        }
    }
    if (audioHandle)
    {
        audioHandle.play();
        if (KomputerSound.debug)
        {
            komputerLog("Playing sound: " + eventType);
        }
    }
}


function incrementPlayIndex(sound)
{
    if (sound.playIndex + 1 < sound.audioHandles.length)
    {
        sound.playIndex++;
    }
    else
    {
        sound.playIndex = 0;
    }
}


function getAmbientAudio()
{
    let audioHandle = new Audio(KomputerSound.path + "ocean.ogg");
    audioHandle.loop = true;
    return [audioHandle];
}


function getBattleArtilleryAudio()
{
    const numAudio = 2;
    const prefix = "battleArtillery";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getBattleCavalryAudio()
{
    const numAudio = 2;
    const prefix = "battleCavalry";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getBattleCivAudio()
{
    return [new Audio(KomputerSound.path + "bells.ogg")];
}


function getBattlePendingAudio()
{
    const numAudio = 2;
    const prefix = "battleInfantry";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".ogg"))
    }
    return audioHandles; 
}


function getBattleRollAudio()
{
    return [new Audio(KomputerSound.path + "drumroll.wav")];
}


function getBattleRollShortAudio()
{
    return [new Audio(KomputerSound.path + "drumroll-short.wav")];
}


function getArtilleryBombardAudio()
{
    const numAudio = 2;
    const prefix = "bombard_a";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getfrigateBombardAudio()
{
    const numAudio = 2;
    const prefix = "bombard_f";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getBuildCivAudio()
{
    const numAudio = 2;
    const prefix = "build";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getCustomizeMapAudio()
{
    return [new Audio(KomputerSound.path + "customizeMap.wav")];
}


function getPlaceReserveAudio(type, numFiles = 3)
{
    const numAudio = numFiles;
    const prefix = type;
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getMoveInfantryAudio()
{
    const numAudio = 2;
    const prefix = "march";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getMoveCavalryAudio()
{
    const numAudio = 2;
    const prefix = "gallop";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getMoveArtilleryAudio()
{
    const numAudio = 2;
    const prefix = "move_artillery";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getMoveFrigateAudio()
{
    const numAudio = 2;
    const prefix = "ship";  
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
}


function getLoseAudio()
{
    const numAudio = 2;
    const prefix = "lose";  
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".ogg"))
    }
    return audioHandles; 
}


function getWinAudio()
{
    return [ new Audio(KomputerSound.path + "win.ogg") ]
}


function getNewGameAudio()
{
    const numAudio = 2;
    const prefix = "newGame";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".ogg"))
    }
    return audioHandles; 
}


function stopAllSound()
{
    if (!KomputerSound)
    {
        return;
    }
    for (const [key, sound] of KomputerSound.playList.entries())
    {
        if (key && sound.audioHandles)
        {
            for (const handle of sound.audioHandles)
            {
                if (!handle.paused)
                {
                    handle.pause();
                    komputerLog("Sound paused.");
                }
            }
        }
    }
}
