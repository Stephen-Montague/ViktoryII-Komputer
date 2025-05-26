/* 
    Viktory II Komputer 
    Adds enhancements for Viktory II on GamesByEmail including:
     - Komputer Opponent AI
     - Historic Nation Visuals
     - Gameplay Sound System
     - Movement Visuals
     - Dark Mode Visuals
     - Game Editor
     - Android Touch Support
     - Performance Upgrades
     - Miscellaneous Patches
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
        initKomputer();
        addArrayPool();
        patchControls();
        addTouchSupport();
        patchGamePrototype(thisGame);
        patchPiecesPrototype(thisGame);
        patchPiecePrototype();
        patchUnitPrototype();
        if (!document.getElementById("KomputerButton_" + GameVersion))
        {
            styleGameMessageBox(thisGame);
            addRunButton("Let Komputer Play", runKomputerClick, thisGame);
            addStopButton("Stop", stopKomputerClick);
            addDarkModeToggle();
            addGameEditor(thisGame);
            addNations(thisGame);
            addLocalMultiplayer(thisGame);
            addSound(thisGame);
            addTurboToggle();
            addKomputerOptions(thisGame);
            cacheElementsForStyling();
        }
        window.onerror = function(error) 
        {
            return handleError(error);
        }
        window.onunhandledrejection = function (error)
        {
            return handleError(error);
        }
        return true;
    }
    return false;
}


function initKomputer()
{
    if (!window.Komputer)
    {
        window.Komputer = {};
    }
}


function handleError(error)
{
    if (error === "Uncaught Error: Force Stop.")
    {
        console.log("Play aborted due to Stop Button click.");
        stopAndReset(true);
        return true;
    }
    console.log("Caught error: ");
    console.log(error);
    if (window.ErrorCount > 2)
    {
        console.log("Will reset controls.");
        stopAndReset(true);
        return window.hasKomputerLog ? false : true;
    }
    else
    {
        window.ErrorCount++;
        console.log("Will resume play.")
        setTimeout( function ()
        {
            let thisGame = findGameForActiveTab();
            runKomputer(thisGame);
        }, 200);
        return true;
    }
}


function addArrayPool()
{
    if (!window.Komputer.arrayPool)
    {
        window.Komputer.arrayPool = [];
    }
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
    if (!window.isKomputerReady || isGhostClick())
    {
        return;
    }
    window.lastClickTime = Date.now(); 
    if (thisGame.player.isMyTurn() && isKomputerPlayApproved(thisGame.perspectiveColor))
    {
        clearLastAction(thisGame);
        patchPieceData(thisGame);
        resetGlobals();
        disableGameEditor();
        styleButtonForRun();
        styleBoardForRun(thisGame.perspectiveColor);
        hideOptionsMenu();
        runKomputer(thisGame);
    }
    else
    {
        window.isKomputerReady = false;
        const isGameWon = thisGame.checkForWin();
        if (isGameWon)
        {
            handleWinState(thisGame);
        }
        else
        {
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
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    verifyElementalIds(thisGame);
    window.currentPlayerTurn = thisGame.perspectiveColor;
    window.isSmallBoard = thisGame.pieces.length === 62;
    window.isLargeBoard = !window.isSmallBoard;
    window.isExtraLargeBoard = playerCount > 4;
    window.isWorldExplored = checkIsWorldExplored(thisGame);
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
    window.ErrorCount = 0;
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
        thisGame.playOptions.mapCustomizationData = shuffleText(activeExploration);
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
    if (!thisGame)
    {
        thisGame = findGameForActiveTab();
    }
    if (window.KomputerNations.isActive)
    {
        let gameStateElement = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameState");
        if (gameStateElement)
        {
            const winnerName = getTeamNoun(getSelectedDescription(thisGame.perspectiveColor));
            const prefix = "The ";
            const specialCase = (winnerName === "Ottoman" || winnerName === "Mughal" || winnerName === "Qing" || winnerName == "Ashanti");
            const firstHalf = specialCase ? prefix + winnerName : winnerName;
            const secondHalf = specialCase ? " Win" : " Wins"
            gameStateElement.innerText = firstHalf + secondHalf;
        }
    }
    setTimeout(function(){
        thisGame.maxMoveNumber = 0;
        window.isKomputerReady = true;
        resetKomputerButtonStyle(true);
    }, 1200);
}


function moveUnits(thisGame)
{
    const moveIntervalBase = (thisGame.playOptions.dark || thisGame.playOptions.independentExploration) ? 1500 : 1300; 
    const moveIntervalPeriod = getTurbo(moveIntervalBase);
    const initialDelay = 100;
    setTimeout(async function(){
        switch (window.moveWave)
        {
            case 0: {
                komputerLog("May move land units and rescue stranded units.");
                let movingUnits = findAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                clearMoveData(movingUnits);
                let frigates = findFrigates(thisGame, [thisGame.perspectiveColor]);
                clearMoveData(frigates);
                let boarders = await findAllBoarders(thisGame, movingUnits, frigates);
                let shouldPreboard = false;
                let strandedUnits = [];
                if (boarders)
                {
                    komputerLog("Preboarding...");
                    movingUnits = boarders;
                    shouldPreboard = true;
                }
                else if (await hasStrandedUnits(thisGame, movingUnits, strandedUnits, frigates) && shouldPickup(thisGame, strandedUnits, frigates))
                {
                    komputerLog("Moving to pickup.");
                    movingUnits = frigates;
                    shouldPreboard = true;
                }
                else if (await completingMove(thisGame, frigates))
                {
                    komputerLog("Moving to dropoff.");
                    movingUnits = frigates;
                    shouldPreboard = true;
                }
                else
                {
                    shuffle(movingUnits);
                    prepareNextUnit(movingUnits);
                }
                const isHoldingWave = false;
                moveEachUnit(thisGame, movingUnits, moveIntervalPeriod, isHoldingWave, shouldPreboard);
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
                const navy = findFrigates(thisGame, [thisGame.perspectiveColor], true);
                const hasAmphib = (navy.length && navy[0].cargo.length);
                const armyNavy = hasAmphib ? navy.concat(army) : army.concat(navy);
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
                handleError("Unhandled moveWave: " + window.moveWave)
                window.moveWave = 2;
                break;
            }
        }
    }, initialDelay);
}


function clearMoveData(units)
{
    for (let unit of units)
    {
        unit.bestMove = null;
        unit.possibleMoves = null;
    }
}


async function findAllBoarders(thisGame, landUnits, frigates)
{
    if (!landUnits.length || !frigates.length)
    {
        return null;
    }
    let boarders = [];
    for (const frigate of frigates)
    {
        if (frigate.movementComplete || !checkHasCapacity(frigate))
        {
            continue;
        }
        await addFrigateBoarders(thisGame, frigate, boarders);
    }
    return boarders.length ? boarders : null;
}


function shouldPickup(thisGame, strandedUnits, frigates)
{
    if (!frigates.length)
    {
        return false;
    }
    const maxCapacity = GamesByEmail.Viktory2Unit.CARGO_CAPACITY.f;
    const movingFrigate = findMovingFrigate(frigates);
    if (movingFrigate)
    {
        if (movingFrigate.cargo.length === maxCapacity)
        {
            return false;
        }
        if (shouldMoverPickup(thisGame, strandedUnits, movingFrigate))
        {
            clearOtherUnits(movingFrigate, frigates);
            return true;
        }
        return false;
    }
    for (let frigate of frigates)
    {
        if (frigate.cargo.length === maxCapacity)
        {
            return false;
        }
        if (frigate.movementComplete)
        {
            continue;
        }
        if (shouldMoverPickup(thisGame, strandedUnits, frigate))
        {
            clearOtherUnits(frigate, frigates)
            return true;
        }
    }
    return false;
}


function findMovingFrigate(frigates)
{
    for (let frigate of frigates)
    {
        if (frigate.spacesMoved && !frigate.movementComplete)
        {
            return frigate;
        }
    }
    return null;
}


function shouldMoverPickup(thisGame, strandedUnits, frigate)
{
    for (let strandedUnit of strandedUnits)
    {
        if (!strandedUnit || !strandedUnit.piece || strandedUnit.movementComplete)
        {
            continue;
        }
        let loadData = {};
        const viaCargo = true;
        const allowBattle = false;
        if (!isAccessibleNow(strandedUnit.piece, frigate, viaCargo, allowBattle, loadData))
        {
            continue;
        }
        const transitFrigate = thisGame.pieces[loadData.index].addUnit(thisGame.perspectiveColor, frigate.type);
        transitFrigate.spacesMoved = frigate.spacesMoved + loadData.spacesNeeded;
        if (hasAmphibTarget(thisGame, transitFrigate, viaCargo, allowBattle)) 
        {
            frigate.bestMove = thisGame.boardPointFromValueIndex(loadData.index).clone();
            frigate.bestMove.index = loadData.index;
            frigate.possibleMoves = loadData.possibleMoves;
            thisGame.pieces[loadData.index].removeUnit(transitFrigate);
            return true;
        }
        thisGame.pieces[loadData.index].removeUnit(transitFrigate);
    }
    return false;
}


async function hasStrandedUnits(thisGame, landUnits, strandedUnits, checkFrigates = null)
{
    if (checkFrigates && !checkFrigates.length)
    {
        return false;
    }
    for (let unit of landUnits)
    {
        if (await isBestScoreBad(thisGame, unit))
        {
            strandedUnits.push(unit);
        }
    }
    return strandedUnits.length ? true : false;
}


async function isBestScoreBad(thisGame, unit)
{
    const possibleMoves = getKomputerMovables(unit);
    if (!possibleMoves)
    {
        return true;
    }
    const maxBadScore = 0.72;
    return !(await hasGoodMove(thisGame, possibleMoves, unit, maxBadScore));
}


async function addFrigateBoarders(thisGame, frigate, allBoarders)
{
    let initialBoarders = [];
    const adjacentIndecies = frigate.piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        if (adjacentPiece.isLand() && adjacentPiece.hasMilitary(frigate.color) && !adjacentPiece.hasBattle(thisGame.perspectiveColor, -1))
        {
            for (const unit of adjacentPiece.units)
            {
                if (!unit.isLandUnit() || unit.movementComplete)
                {
                    continue;
                }
                let possibleMoves = getKomputerMovables(unit);
                if (!possibleMoves)
                {
                    continue;
                }
                const favorOffense = true;
                const getScore = false;
                const preboard = true;
                let bestMove = await decideBestMove(thisGame, possibleMoves, unit, favorOffense, getScore, preboard);
                if (bestMove.index === frigate.piece.index) 
                {
                    if (checkHasCapacity(frigate, initialBoarders.length))
                    {
                        unit.bestMove = bestMove;
                        initialBoarders.push(unit);
                    }
                    else
                    {
                        addBoarders(initialBoarders, allBoarders);
                        return;
                    }
                }
            }
        }
    }
    addBoarders(initialBoarders, allBoarders);
}


function addBoarders(initialBoarders, allBoarders)
{
    for (const initialBoarder of initialBoarders)
    {
        allBoarders.push(initialBoarder);
    }
}


function checkHasCapacity(frigate, additionalCargoCount = 0)
{
    const maxCapacity = GamesByEmail.Viktory2Unit.CARGO_CAPACITY.f
    const capacityUsed = frigate.cargo.length + frigate.cargoUnloaded + additionalCargoCount;
    return (capacityUsed < maxCapacity); 
}


async function completingMove(thisGame, frigates)
{
    if (!frigates.length)
    {
        return false;
    }
    const movingFrigate = findMovingFrigate(frigates);
    if (movingFrigate)
    {
        movingFrigate.possibleMoves = getFrigateMovables(movingFrigate);
        movingFrigate.bestMove = await decideBestMove(thisGame, movingFrigate.possibleMoves, movingFrigate, true);
        clearOtherUnits(movingFrigate, frigates);
        return true;
    }
    for (const frigate of frigates)
    {
        if (!frigate.movementComplete && frigate.hasUnloadables())
        {
            frigate.possibleMoves = getFrigateMovables(frigate);
            frigate.bestMove = await decideBestMove(thisGame, frigate.possibleMoves, frigate, true);
            clearOtherUnits(frigate, frigates);
            return true;
        }
    }
    return false
}


function clearOtherUnits(unitToKeep, otherUnits)
{
    while (otherUnits.indexOf(unitToKeep) !== (otherUnits.length-1))
    {
        otherUnits.pop();
    }
    while (otherUnits.indexOf(unitToKeep) !== 0)
    {
        otherUnits.shift();
    }
}


function checkIsWorldExplored(thisGame)
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
    const maxUnitCount = window.KomputerTurbo ? 16 : 24;
    if (units.length > maxUnitCount)
    {
        return;
    }
    const enemyColors = getEnemyColors(thisGame);
    let enemyArmies = getArmyUnits(thisGame, enemyColors);
    if (!enemyArmies || enemyArmies.length > maxUnitCount)
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
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    const colorCount = playerCount;
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
    if (!unitList || unitList.length === 0 || !lastMovedUnit || !lastMovedUnit.piece)
    {
        return;
    }
    if (lastMovedUnit.movementComplete || lastMovedUnit.piece.hasEnemy(lastMovedUnit.color, lastMovedUnit.rulerColor))
    {
        window.lastMovedUnit = null;
        return;
    }
    window.movingUnitIndex = 0;
    const firstUnit = unitList[window.movingUnitIndex];
    if (firstUnit && (firstUnit.index === lastMovedUnit.index) && (firstUnit.type === lastMovedUnit.type) && (firstUnit.piece.index === lastMovedUnit.piece.index))
    {
        return;
    }
    let nextUnitIndex = null;
    for (let i = 0; i < unitList.length; i++)
    {
        const unit = unitList[i];
        if (!unit || !unit.piece)
        {
            continue;
        }
        if ((unit.index === lastMovedUnit.index) && (unit.type === lastMovedUnit.type) && (unit.piece.index === lastMovedUnit.piece.index))
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


function findFrigates(thisGame, colors, loadedFirst = false, pieceList = null, noBattles = true)
{
    let frigates = [];
    if (pieceList === null)
    {
        pieceList = thisGame.pieces;
    }
    for (const piece of pieceList)
    {
        const isReserve = piece.valueIndex === - 1;
        if (piece.hidden || piece.isDark || isReserve || (piece.hasBattle(thisGame.perspectiveColor, -1) && noBattles))
        {
            continue;
        }
        for (const unit of piece.units)
        {
            if (colors.includes(unit.color) && unit.isFrigate())
            {
                const hasCargo = unit.cargo.length > 0;
                if (loadedFirst && hasCargo)
                {
                    frigates.unshift(unit);
                }
                else
                {
                    frigates.push(unit);
                }
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
            handleError("Game reports a battle pending but none found.");
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
        const possibleLastMovers = holdingUnits.concat(findFrigates(thisGame, [thisGame.perspectiveColor], true));
        if (possibleLastMovers.length)
        {
            const isHoldingWave = true;
            prepareNextUnit(possibleLastMovers);
            moveEachUnit(thisGame, possibleLastMovers, moveIntervalPeriod, isHoldingWave);
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
                if (!playingNextTurn(thisGame))
                {
                    resetKomputerButtonStyle();
                    window.isKomputerReady = true;
                    komputerLog("Done.");
                }
            }
            else
            {    
                window.moveWave = 0;
                handleError("Cannot end movement phase.");
            }
        }, 100);
    }, 100);
}


async function moveEachUnit(thisGame, movableUnits, intervalPeriod, isHoldingWave = false, isPreboard = false)
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
        if (!isHoldingWave && !isPreboard && fightPreMoveBattles(thisGame))
        {
            return;
        }
        // Get the next unit and decide if it may move.
        const nextUnitIndex = getNextUnitIndex(thisGame, movableUnits);
        const isClickable = ensureClickable(thisGame, movableUnits, nextUnitIndex);
        const unit = movableUnits[nextUnitIndex];
        const firstMainWave = 0;
        const finalMainWave = 2;
        let possibleMoves = null;
        let shouldAcceptMove = null;
        let isUnitSelected = null;
        const mayMove = decideMayMove(thisGame, unit, firstMainWave, finalMainWave, isClickable);
        if (mayMove)
        {
            if (isPreboard)
            {
                possibleMoves = unit.possibleMoves ? unit.possibleMoves : unit.bestMove ? true : false;
            }
            else
            {
                possibleMoves = unit.isFrigate() ? getFrigateMovables(unit) : getKomputerMovables(unit); 
            }
            if (possibleMoves)
            {
                // Decide best move, or don't accept any to stay.
                const favorOffense = isPreboard ? true : shouldFavorOffense(thisGame, firstMainWave, movableUnits.length);
                let bestMove = isPreboard ? unit.bestMove : await decideBestMove(thisGame, possibleMoves, unit, favorOffense);
                decideTransitMove(unit, bestMove, possibleMoves);
                const pieceIndex = bestMove.index;
                shouldAcceptMove = isPreboard ? true : await decideMoveAcceptance(thisGame, unit, pieceIndex, isHoldingWave);
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
                            playMoveSound(unit);
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
                                    playMoveSound(unit);
                                }
                                hideEndTurnButtons();
                                isUnitSelected = false;
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
                                decideFrigateFlags(thisGame, unit, finalMainWave, pieceIndex, isPreboard);
                            }, processMouseDownUpdateTime);
                        }, transitTime);
                    }
                    // Rare: fails to select.
                    else
                    {
                        komputerLog("Failed to select unit for move. Logging unit.");
                        komputerLog(unit);
                        clearMovementFlags(unit, false);
                        window.lastMovedUnit = null;
                    }   
                } // End if shouldAcceptMove
            } // End if possibleMoves
        } // End if may move
        const processMoveSuccess = (mayMove && possibleMoves && shouldAcceptMove && isUnitSelected);
        if (!processMoveSuccess)
        {
            clearMovementFlags(unit, false);
        }
        const processMoveUpdateTime = processMoveSuccess ? intervalPeriod - 152 : 200;
        setTimeout(function()
        {
            if (isUnitSelected)
            {
                window.isMoving = false;
                return;
            } 
            decideHowToContinueMove(thisGame, movableUnits, unit, finalMainWave, isPreboard);
        }, processMoveUpdateTime);
    }, intervalPeriod));
}


function decideTransitMove(unit, bestMove, possibleMoves)
{
    if (window.isWorldExplored)
    {
        return;
    }
    let shouldTransit = true;
    let immediateMoves = unit.getMovables();
    if (!immediateMoves)
    {
        return;
    }
    while(shouldTransit)
    {
        for (const move of immediateMoves)
        {
            if (move.equals(bestMove))
            {
                shouldTransit = false;
                break;
            }
        }
        if (shouldTransit)
        {
            for (let i = possibleMoves.length-1; i >= 0; i--)
            {
                const possibleMove = possibleMoves[i];
                if (possibleMove.index === bestMove.retreatIndex)
                {
                    bestMove = possibleMove;
                    break;
                }
            }
        }
    }
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
                if (window.isUnloading || isNotOverkill(thisGame, piece) || willGetAmphibLanding(thisGame, piece))
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


function willGetAmphibLanding(thisGame, piece)
{
    let pieceList = [];
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const index of adjacentIndecies)
    {
        pieceList.push(thisGame.pieces[index]);
    }
    const frigates = findFrigates(thisGame, [thisGame.perspectiveColor], true, pieceList);
    for (const frigate of frigates)
    {
        if (frigate.hasUnloadables() && (frigate.disembarkIndex === piece.index))
        {
            return true;
        }
    }
    return false;
}


function clearMovementFlags(unit = null, clearMoving = true)
{
    if (unit)
    {
        unit.isManeuveringToAttack = false;
    }
    window.isMoving = clearMoving ? false : true;
    window.isManeuveringToAttack = false;
    window.isExploring = false;
    window.isBombarding = false
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


function ensureClickable(thisGame, movableUnits, nextUnitIndex)
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
        if (unit.movementComplete || unit.index === movableUnit.index || !unit.isMilitary() || !movableUnits.includes(unit))
        {
            continue;
        } 
        if (unit.type === movableUnit.type && unit.zIndex > movableUnit.zIndex) // unit.retreatIndex === movableUnit.retreatIndex && 
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
    // Unit can move or unload:
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
    if (unit.movementComplete && !unit.canBombard() && !unit.hasUnloadables())
    {
        return false;
    }
    if (unit.isFrigate() && !unit.hasUnloadables())
    {
        window.isUnloading = false;
    }
    return true;
}


function isNotValidUnit(thisGame, unit)
{
    return (!unit || !unit.piece || !unit.piece.pieces || !thisGame.pieces[unit.piece.index].units[unit.index] || 
        (unit !== thisGame.pieces[unit.piece.index].units[unit.index])
    ); 
}


function komputerLog(data, isMoveLog = false)
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
        if (isMoveLog)
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
        else
        {
            console.log(data);
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
    }, getTurbo(600));
}


function handleMoveTrail(thisGame, unit, possibleMoves, movePoint)
{
    unit.setHilite(true);
    let bufferTime = 0;
    if (window.KomputerTurbo || movePoint.spacesNeeded < 2)
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
                if (window.KomputerNations.isActive)
                {
                    transitUnit.maskColor = getSelectedMaskColor(transitUnit);
                }
                transitPiece.updateUnitDisplay();
                setTimeout(function()
                {
                    transitPiece.removeUnit(transitUnit);
                    transitPiece.updateUnitDisplay();
                }, 712);
            }
        }, 128);
    }
    return bufferTime;
}


function decideFrigateFlags(thisGame, unit, finalMoveWave, pieceIndex, isPreboard)
{
    if (isPreboard)
    {
        return;
    }
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


function decideHowToContinueMove(thisGame, movableUnits, unit, finalMoveWave, isPreboard = false)
{
    hideEndTurnButtons();
    confirmManeuverFlag(unit); 
    window.isMoving = false;
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
        unit.isManeuveringToAttack = false;
        unit.movementComplete = true;
        unit.holding = false;
        clearMoveIntervals();
        bombard(thisGame, unit, unit.getBombardables());
        return;
    }
    // If more units, when the last-moved unit is done, move the next unit.
    if ((window.movingUnitIndex + 1) < movableUnits.length)
    {
        if (window.lastMovedUnit && !isPreboard)
        {
            const lastMovedUnit = window.lastMovedUnit;
            const isValidUnit = (lastMovedUnit && lastMovedUnit.piece && thisGame.pieces[lastMovedUnit.piece.index].units[lastMovedUnit.index] && 
                                lastMovedUnit === thisGame.pieces[lastMovedUnit.piece.index].units[lastMovedUnit.index]);
            if (isValidUnit && !lastMovedUnit.movementComplete && !lastMovedUnit.holding)
            {
                for (let i = 0; i < movableUnits.length; i++)
                {
                    // Confirm index to ensure the correct unit moves next. 
                    if (lastMovedUnit === movableUnits[i])
                    {
                        window.movingUnitIndex = i;
                    }
                }
                return;
            }
        } 
        unit.isManeuveringToAttack = false;
        window.movingUnitIndex++;
        return;
    }
    // Clear and reset for next wave.
    clearMoveIntervals();
    clearMovementFlags(unit);
    window.movingUnitIndex = 0;
    if (isPreboard)
    {
        window.moveWave = 0;
    }
    else
    {
        window.moveWave++;
    }
    runKomputer(thisGame);
    return;
}


function confirmManeuverFlag(unit)
{
    window.isManeuveringToAttack = (window.isManeuveringToAttack && unit.isManeuveringToAttack && !unit.movementComplete && !unit.holding) ? true : false;
}


function shouldBombard(thisGame, unit, finalMoveWave)
{
    if (isNotValidUnit(thisGame, unit) || !unit.canBombard())
    {
        return false;
    }
    const hasFrigatePin = hasAdjacentEnemyFrigate(thisGame, unit.piece);
    return (hasFrigatePin && unit.piece.hasCivilization(thisGame.perspectiveColor)) ||
    ((unit.movementComplete || window.moveWave >= finalMoveWave) && (hasFrigatePin || hasAdjacentEnemyArmy(thisGame, unit.piece)));
}


async function decideBestMove(thisGame, movePoints, unit, favorOffense, getScore = false, preboarding = false)
{
    let bestMoveScore = -1;
    let bestMoves = [];
    for (const movePoint of movePoints)
    {
        const possibleMoveScore = await getMoveScore(thisGame, movePoint, unit, favorOffense, preboarding);
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
    const bestMove = bestMoves.length > 1 ? getRandomItem(bestMoves) : bestMoves[0];
    if (!preboarding && window.hasKomputerLog)
    {
        const moveData = {game: thisGame, unit: unit, score: bestMoveScore, bestMoveIndex: bestMove.index};
        komputerLog(moveData, true);
    }
    return bestMove;
}


async function hasGoodMove(thisGame, movePoints, unit, targetScore)
{
    for (const movePoint of movePoints)
    {
        const possibleScore = await getMoveScore(thisGame, movePoint, unit, true);
        if (possibleScore > targetScore)
        {
            return true;
        }
    }
    return false;
}


async function getMoveScore(thisGame, possibleMovePoint, unit, favorOffense, preboard = false)
{
    // Get score in range [0, 1].
    const piece = thisGame.pieces[possibleMovePoint.index];
    const enemyColor = piece.getOpponentColor(thisGame.perspectiveColor);
    const primaryTargetColors = window.primaryTargetColors ? window.primaryTargetColors : decidePrimaryTargetColors(thisGame);
    if (!window.enemyTargets.length)
    {
        await rankEnemyTargets(thisGame);
    }
    if (unit.isFrigate())
    {
        return getFrigateMoveScore(thisGame, piece, unit, enemyColor, primaryTargetColors);
    }
    else
    {
        const terrainDefenseBonus = getTerrainDefenseBonus(piece); 
        let score = 0;
        if (piece.hasRollingOpponent(thisGame.perspectiveColor))
        {
            score = getJoinBattleScore(thisGame, unit, piece, enemyColor, primaryTargetColors);
        }
        else if (hasAdjacentEnemyLandContact(thisGame, piece))
        {
            score = getContactEnemyScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, primaryTargetColors, preboard);
        }
        else if (piece.hasCivilization(thisGame.perspectiveColor))
        {
            score = await getCivilDefenseScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, favorOffense); 
        }
        else if (piece.hasFrigate(thisGame.perspectiveColor))
        {
            score = await getBoardingFrigateScore(thisGame, piece);
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


function getCenterPiecePoint(thisGame)
{
    const centerPieceIndex = Math.floor((thisGame.pieces.length * 0.5) - 1);
    return thisGame.pieces[centerPieceIndex].boardPoint.clone(); 
}


function guessTravelCostToTarget(thisGame, unit, pieceOrigin)
{
    // Find an exact path on visible terrain to the nearest enemy.
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    const maxDistance = playerCount > 5 ? 16 : 24; 
    let travelCost = findPathCostToEnemy(thisGame, unit, pieceOrigin, maxDistance);
    // Otherwise find a manhattan distance, either to an enemy starting hex or to a nearest hidden hex, if any, else the center hex.
    if (travelCost === maxDistance)
    {
        let destinationPoint = null;
        const enemyColors = getEnemyColors(thisGame);
        const enemyColor = getRandomItem(enemyColors);
        const originPoint = pieceOrigin.boardPoint.clone();
        if (Math.random() < 0.6)
        {
            destinationPoint = getRandomItem(thisGame.getCapitalPoints(thisGame.info.board, enemyColor, thisGame.playOptions, false)); 
        }
        else
        {
            let hiddenPieces = [];
            let minManhattanDistance = Number.MAX_VALUE;
            for (const piece of thisGame.pieces)
            {
                if (piece.hidden)
                {
                    const manhattanDistance = thisGame.distanceBewteenPoints(originPoint, piece.boardPoint.clone());
                    if (manhattanDistance < minManhattanDistance)
                    {
                        minManhattanDistance = manhattanDistance;
                        hiddenPieces.length = 0;
                        hiddenPieces.push(piece);
                    }
                    else if (manhattanDistance === minManhattanDistance)
                    {
                        hiddenPieces.push(piece);
                    }
                }
            }
            if (hiddenPieces.length)
            {
                destinationPoint = getRandomItem(hiddenPieces).boardPoint.clone();
            }
            else
            {
                destinationPoint = getCenterPiecePoint(thisGame);
            }
        }
        travelCost = thisGame.distanceBewteenPoints(originPoint, destinationPoint);
    }
    return travelCost;
}


function findPathCostToEnemy(thisGame, unit, pieceOrigin, maxDistance)
{
    let travelCost = maxDistance;
    let terrestialType = unit.isFrigate() ? unit.type : "c";
    let possibleUnit = pieceOrigin.addUnit(thisGame.perspectiveColor, terrestialType);
    possibleUnit.movementAllowance = maxDistance;
    let allReachablePoints = possibleUnit.getMovables();
    if (allReachablePoints && allReachablePoints.length)
    {
        for (const reachablePoint of allReachablePoints)
        {
            const reachablePiece = thisGame.pieces[reachablePoint.index];
            if (reachablePiece.hidden)
            {
                continue;
            }
            if (reachablePiece.hasRollingOpponent(thisGame.perspectiveColor) && reachablePoint.spacesNeeded < travelCost)
            {
                let isPathVisible = true;
                let priorIndex = reachablePoint.retreatIndex;
                let stepCount = 0;
                const failSafe = maxDistance;
                while ((priorIndex !== pieceOrigin.index) && (stepCount < failSafe))
                {
                    let priorPiece = thisGame.pieces[priorIndex];
                    if (priorPiece.hidden)
                    {
                        isPathVisible = false;
                        break;
                    }
                    for (let point of allReachablePoints)
                    {
                        if (point.index === priorIndex)
                        {
                            priorIndex = point.retreatIndex;
                        }
                    }
                    stepCount++;
                }
                if (isPathVisible)
                {
                    travelCost = reachablePoint.spacesNeeded;
                }
            }        
        }
    }
    pieceOrigin.removeUnit(possibleUnit);
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
            return piece.hasCapital(enemyColor) ? 0.9999 : defendingRollCount === 1 ? 0.999 : 0.98;
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
        else
        {
            score *= 0.8;
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


function getContactEnemyScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, primaryTargetColors, preboard = false)
{
    const adjacentEnemyCivs = findAdjacentEnemyCivs(thisGame, piece);
    let hasPin = getHasPin(thisGame, adjacentEnemyCivs);
    const newPinMultiplier = (hasPin && piece.units.length === 0) ? 1.25 : 1;
    const bonus = terrainDefenseBonus * newPinMultiplier;
    let score = hasPin ? 0.70 + bonus  : 0.65 + bonus;
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
    // Never send cavalry alone in the open next to an enemy civ.
    const remainingMoveAllowance = unit.movementAllowance - unit.spacesMoved;
    if (unit.isCavalry() && hasSmoothTerrain(piece) && (piece.countMilitaryUnits(piece.units) === 0) &&
        (possibleMovePoint.spacesNeeded === remainingMoveAllowance))
    {
        score = 0;
    }
    // Maybe maneuver unit before attack.
    // If unit has extra moves close to a battle, pass through open terrain to get more attack vectors.
    const canManeuverBeforeAttack = (possibleMovePoint.spacesNeeded < remainingMoveAllowance && 
        (unit.isCavalry() || hasSmoothTerrain(piece)));
    if (canManeuverBeforeAttack && hasAdjacentBattle(thisGame, piece)) 
    {
        const battlePiece = findAdjacentBattle(thisGame, piece);
        const attackVectors = battlePiece.collectRetreatIndices(thisGame.perspectiveColor);
        if (!attackVectors.includes(piece.index) || (attackVectors.includes(unit.piece.index) && Math.random() < 0.4))
        {
            if (!preboard)
            {
                unit.isManeuveringToAttack = true;
                window.isManeuveringToAttack = true;
                window.movingToAttackIndex = battlePiece.index;
                window.movingToAttackOrigin = piece.index;
            }
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
    const randomVariance = Math.random() * 0.0125;
    score += randomVariance;
    return score;
}


async function getCivilDefenseScore(thisGame, unit, piece, possibleMovePoint, terrainDefenseBonus, favorOffense) 
{
    let score = 0;
    const pinningArmy = hasAdjacentEnemyArmy(thisGame, piece);
    const pinningNavy = hasAdjacentEnemyFrigate(thisGame, piece);
    const vulnerable = await isVulnerable(thisGame, piece);
    if (vulnerable && (pinningArmy || pinningNavy || hasIsolatedForestCity(thisGame, piece)))
    {
        const defendingRollCount = piece.numDefenderRolls(thisGame.perspectiveColor);
        if (piece.hasCapital(thisGame.perspectiveColor) || (defendingRollCount < 3) || (pinningNavy && unit.isArtillery()))
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
    return piece.isForest() && piece.hasCity(color) && !hasAdjacentFriendlyArmy(thisGame, piece, color) && !piece.hasCapital(color);
}


async function getBoardingFrigateScore(thisGame, piece)
{
    let score = 0;
    const frigates = findFrigates(thisGame, [thisGame.perspectiveColor], false, [piece]);
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
    const travelCostToTarget = guessTravelCostToTarget(thisGame, unit, piece);
    let score = (0.36 + terrainDefenseBonus) / (1 + travelCostToTarget);
    let civSupportCount = 0;
    const friendlyCivs = findAdjacentFriendlyCivs(thisGame, piece, unit.color);
    for (const civ of friendlyCivs)
    {
        if (await isVulnerable(thisGame, civ))
        {
            score += civSupportCount < 3 ? 0.16 : 0.02;
            civSupportCount++;
        }
    }
    const adjacentHiddenCount = countAdjacentHiddenTerrain(thisGame, piece); 
    if (adjacentHiddenCount)
    {
        let explorationMultiplier = score < 0.7 ? 0.06 : 0.02;
        score += adjacentHiddenCount * explorationMultiplier;
    }
    // Special case - small board, first turn: 
    if (window.isSmallBoard)
    {
        const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
        const isEarlyGame = thisGame.maxMoveNumber < (12 * playerCount);
        const isFirstTurnMove = thisGame.pieces.getCivilizations(thisGame.perspectiveColor).length < 3;
        if (isEarlyGame && isFirstTurnMove) 
        {
            // Explore toward center.
            const stronglyEmphasizedIndecies = [15, 22, 38];
            if (stronglyEmphasizedIndecies.includes(piece.index))
            {
                score += 0.25;
            }
            const emphasizedIndecies = [14, 23];
            if (emphasizedIndecies.includes(piece.index))
            {
                score += 0.1875;
            }
            // Prefer start-adjacent for exploration over roads.
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
    if (unit && unit.hasUnloadables())
    {
        // Loaded frigates should move toward enemy coastal towns.
        const enemyCivs = [];
        for (const target of window.enemyTargets)
        {
            const isVisible = !target.hidden && (!target.isDark || thisGame.getMemoryUnits(target.index).length);
            if (isVisible)
            {
                enemyCivs.push(target);
            }
        }
        let coastalCivs = [];
        for (const enemyCiv of enemyCivs)
        {
            if (isAccessibleNow(enemyCiv, unit, true, false) || (hasAdjacentDeepWater(thisGame, unit.piece) && hasAdjacentDeepWater(thisGame, enemyCiv)))
            {
                coastalCivs.push(enemyCiv);
            }
        } 
        const targetCivs = coastalCivs.length ? coastalCivs : enemyCivs;
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
        const hasEnemyCiv = piece.hasOpponentCivilization(thisGame.perspectiveColor);
        score += hasEnemyCiv ? 0.03125 : piece.isMountain() ? 0.01875 : piece.isForest() ? 0.01125 : 0;
        if (hasEnemyCiv)
        {
            score = (score + getCivAttackScore(thisGame, piece)) * 0.5;
        }
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
    // Add pennants to sim enemy terrain modifiers.
    const enemyColors = colors === null ? getEnemyColors(thisGame) : colors;
    let temporaryPennants = markTempPennants(thisGame, enemyColors);
    let threat = {count: 0, frigateCount: 0, units : [], hasInfantry: false, hasCavalry : false, hasArtillery: false, hasAmphib : false, hasPin : false};
    guessArmyThreat(thisGame, piece, enemyColors, threat);
    for (const pennant of temporaryPennants)
    {
        pennant.piece.removeUnit(pennant);
    }
    const loadedFirst = false;
    const specificPieces = null;
    const skipBattles = false;
    const enemyFrigates = findFrigates(thisGame, enemyColors, loadedFirst, specificPieces, skipBattles);
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
    const navalWeight = threat.hasAmphib ? threat.frigateCount * 0.6 : 0;
    const artilleryWeight = threat.hasArtillery ? 0.4 : 0;
    return ((threatRollCount * rollScalar) + threat.count + navalWeight + artilleryWeight);
}


function markTempPennants(thisGame, enemyColors)
{
    let temporaryPennants = [];
    for (const color of enemyColors)
    {
        if (color === thisGame.perspectiveColor)
        {
            continue;
        }
        for (const piece of thisGame.pieces)
        {
            if (piece.hidden || piece.isDark) 
            {
                continue;
            }
            if (hasRoughTerrain(piece) && piece.hasMilitary(color))
            {
                temporaryPennants.push(piece.addUnit(color, "p"));
            }
        }
    }
    return temporaryPennants;
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


function guessArmyThreat(thisGame, piece, enemyColors, threat)
{
    let enemyArmyUnits = getArmyUnits(thisGame, enemyColors);
    let expectedDarkUnits = guessDarkUnits(thisGame);
    if (!enemyArmyUnits && !expectedDarkUnits.length)
    {
        return;
    }
    else if (enemyArmyUnits)
    {
        enemyArmyUnits = enemyArmyUnits.concat(expectedDarkUnits);
    }
    else 
    {
        enemyArmyUnits = expectedDarkUnits;
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
    for (let unit of expectedDarkUnits)
    {
        unit.piece.removeUnit(unit);
    }
}


function guessDarkUnits(thisGame)
{
    if (!thisGame.player.team.info.darkMemory)
    {
        return [];
    }
    let darkUnits = [];
    for (const piece of thisGame.pieces)
    {
        if (!piece.hidden && piece.isDark)
        {
            const memUnits = thisGame.getMemoryUnits(piece.index);
            if (memUnits.length)
            {
                let enemyColor = memUnits[0].color;
                switch(piece.boardValue)
                {
                    case "g":
                    {
                        darkUnits.push(piece.addUnit(enemyColor, "c"));
                        darkUnits.push(piece.addUnit(enemyColor, "i"));
                        break;
                    }
                    case "m":
                    {
                        darkUnits.push(piece.addUnit(enemyColor, "a"));
                        darkUnits.push(piece.addUnit(enemyColor, "i"));
                        break;
                    }
                    case "f":
                    {
                        darkUnits.push(piece.addUnit(enemyColor, "i"));
                        break;
                    }
                    case "p":
                    {
                        for (let i = 0; i < 3; i++)
                        {
                            darkUnits.push(piece.addUnit(enemyColor, "i"));
                        }
                        break;
                    }
                }
            }    
        }
    }
    return darkUnits;
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
    if ((cargoCount >= maxCapacity) || (remainingCapacity <= 0))
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
        distance = thisGame.distanceBewteenPoints(civPiece.boardPoint.clone(), originPiece.boardPoint.clone());
        if (distance < minDistance)
        {
            minDistance = distance
        }
        if (minDistance === 0)
        {
            return minDistance;
        }
    }
    if (minDistance === Number.MAX_VALUE)
    {
        const enemyColors = getEnemyColors(thisGame);
        const enemyColor = getRandomItem(enemyColors);
        const originPoint = originPiece.boardPoint.clone();
        const destinationPoint = getRandomItem(thisGame.getCapitalPoints(thisGame.info.board, enemyColor, thisGame.playOptions, false)).clone(); 
        return thisGame.distanceBewteenPoints(originPoint, destinationPoint);
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
            if (attackingToBreakSiege && hasWeakPin(thisGame, unit.piece) && (hasAdjacentSupport(thisGame, unit.piece) || hasDualPinCounterAttack(thisGame, destinationPiece)))
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


function hasDualPinCounterAttack(thisGame, enemyPiece)
{
    let friendlySideCount = 0;
    let friendlySideIndecies = [];
    const adjacentPieceIndices = enemyPiece.getAdjacentIndecies(1);
    for (const adjacentPieceIndex of adjacentPieceIndices)
    {
        let adjacentPiece = thisGame.pieces[adjacentPieceIndex];
        if (adjacentPiece.getMilitaryUnitCount(thisGame.perspectiveColor))
        {
            for (const unit of adjacentPiece.units)
            {
                if (unit.isMilitary() && !unit.movementComplete && !unit.piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.color) && hasWeakPin(thisGame, unit.piece))
                {
                    friendlySideCount++;
                    if (friendlySideCount > 1)
                    {
                        return true;
                    }
                    friendlySideIndecies.push(unit.piece.index);
                    break;
                }
            }
        }
    }
    if (enemyPiece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.color))
    {
        const attackerOriginIndices = enemyPiece.collectRetreatIndices(thisGame.perspectiveColor);
        for (const friendlySideIndex of friendlySideIndecies)
        {
            if (!attackerOriginIndices.includes(friendlySideIndex))
            {
                return true;
            }
        }
    }
    return false;
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
        const adjacentEnemyTowns = findAdjacentEnemyTowns(thisGame, frigate.piece); 
        const pinsEnemyTown = getHasPin(thisGame, adjacentEnemyTowns);
        const destinationAdjacentEnemyTowns = findAdjacentEnemyTowns(thisGame, destinationPiece); 
        const movingToPin =  getHasPin(thisGame, destinationAdjacentEnemyTowns);
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


function getHasPin(thisGame, adjacentEnemyCivs)
{
    let hasPin = false;
    for (const enemyCiv of adjacentEnemyCivs)
    {
        if (!enemyCiv.hasOpponentCapital(thisGame.perspectiveColor))
        {
            hasPin = true;
        }
    }
    return hasPin;
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


function hasAdjacentSupport(thisGame, piece)
{
    const adjacentPieceIndices = piece.getAdjacentIndecies(1);
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
    if (window.holdingUnits && window.holdingUnits.length)
    {
        for (let unit of window.holdingUnits)
        {
            unit.holding = false;
        }
        window.holdingUnits = [];
    }
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
                const commitDelay = getTurbo(600);
                setTimeout(function(){
                    thisGame.overlayCommitOnClick();
                    setTimeout(function(){ replaceBattleMessage(thisGame) }, 16);
                    // Apply hits.
                    const applyHitsDelay = 100;
                    setTimeout(function(){
                        replaceBattleMessage(thisGame);
                        if (thisGame.battleData)
                        {
                            const data = thisGame.getBattleData();
                            if (data && data.piece.defenderBattleInfo &&
                                data.piece.defenderBattleInfo.decisionNeeded)
                            {
                                applyHits(thisGame, data.piece.index, data, true);
                            }
                        }
                        const reviewDelay = getTurbo(800);
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
    playInitBattleSounds(battlePiece);
    const markBattleDelay = 500;
    setTimeout(function()
    {
        selectBattle(thisGame, battlePiece);
        const rollDelay = 600;
        let firstRoll = true;
        setTimeout(function roll(){
            let doPreBattle = false;
            const anyColor = -1;
            if (thisGame.pieces[battlePiece.index].hasArtillery(anyColor))
            {
                playSound("battleArtillery");
                const hasOpponentMilitary = thisGame.pieces[battlePiece.index].hasNonRulingOpponentMilitary(thisGame.perspectiveColor, anyColor);
                if (firstRoll && hasOpponentMilitary)
                {
                    doPreBattle = true;
                }
            }
            thisGame.overlayCommitOnClick();
            setTimeout(function(){ replaceBattleMessage(thisGame) }, 100);
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
                const battleReviewDelay = getTurbo(1700);
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
                            if (doPreBattle)
                            {
                                thisGame.pieces[battlePiece.index].preBattleOkClick(thisGame.player.team.color);
                            }
                            else
                            {
                                thisGame.pieces[battlePiece.index].battleOkClick(thisGame.player.team.color);
                            }
                            hideEndTurnButtons();
                            replaceBattleMessage(thisGame);
                            const reRollDelay = getTurbo(1200);
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
                                    firstRoll = false;
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
                                            }, getTurbo(400));
                                        }, battleReviewDelay);
                                    }
                                    else
                                    {
                                        // After battle
                                        ensureMovementComplete(thisGame, piece.index);
                                        thisGame.update();
                                        rankEnemyTargets(thisGame);
                                        const afterBattleDelay = 1000;
                                        setTimeout(function()
                                        {
                                            window.hasBattleBegun = false; 
                                            runKomputer(thisGame) 
                                        }, afterBattleDelay);
                                    }
                                }
                            }, reRollDelay);
                        } // No roll result - an odd phenomena - log and rerun.
                        else
                        {
                            komputerLog("Battle result missing.");
                            const afterBattleDelay = 800;
                            setTimeout(function()
                            {
                                window.hasBattleBegun = false;
                                runKomputer(thisGame);
                            }, afterBattleDelay);
                        }
                    }
                    // Game won.
                    else
                    {
                        handleWinState(thisGame);                        
                    }
                }, battleReviewDelay);
            }, applyHitsDelay);
        }, rollDelay);
    }, markBattleDelay);
}


function playInitBattleSounds(battlePiece)
{
    playSound("battleRoll");
    const anyColor = -1;
    if (battlePiece.hasCavalry(anyColor))
    {
        if (window.KomputerNations.isActive)
        {
            playCavalryBattle(battlePiece);
        }
        else
        {
            playSound("battleCavalry");
        }
    }
    if (battlePiece.hasArtillery(anyColor) || battlePiece.hasFrigate(anyColor))
    {
        playSound("battleArtillery");
    }    
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


function replaceBattleMessage(thisGame)
{
    let battleMessage = document.querySelector("#Foundation_Elemental_" + GameVersion + "_centerOverPiece > tbody > tr:nth-child(3) > td");
    if (battleMessage && battleMessage.innerText.substr(0, 3) === "You")
    {
        let teamName = null;
        if (window.KomputerNations.isActive)
        {
            const nationSelector = document.getElementById("NationSelector_" + thisGame.perspectiveColor);
            const nation = window.KomputerNations.menuOptions[nationSelector.selectedIndex];
            const suffix = window.KomputerNations.menuPluralAddSuffix[nation] ? "s" : "";
            teamName = "The " + nation + suffix;
        }
        else
        {
            teamName = GamesByEmail.Viktory2Game.resourcePack.teamTitles[thisGame.perspectiveColor];
        }
        battleMessage.innerText = teamName + " " + battleMessage.innerText.substr(3);
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
        setTimeout(function(){ thisPiece.bombardOkClick(attackerColor) }, getTurbo(400));
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
    window.reserveIntervalIds.push(setInterval(placeReserveUnit, getTurbo(1200), thisGame));
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
    const controlsCapital = thisGame.doesColorControlTheirCapital(thisGame.player.team.color);
    const hasReserveUnit = getHasPlayableReserveUnit(thisGame, controlsCapital, true);
    if (hasReserveUnit)
    {
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


function getHasPlayableReserveUnit(thisGame, controlsCapital, select, color = null, unitType = null)
{
    const reserveUnits = color === null ? thisGame.player.team.reserveUnits : thisGame.teams.findTeamByColor(color).reserveUnits;
    if (reserveUnits.length > 0)
    {
        for (let i = reserveUnits.length - 1; i >= 0; i--)
        {
            if (thisGame.couldPlaceReserveUnit(reserveUnits[i], thisGame.player.team.color, controlsCapital))
            {
                if (select || unitType)
                {
                    if (select && (!unitType || reserveUnits[i] === unitType ))
                    {
                        const element = document.querySelector("#Foundation_Elemental_" + GameVersion + "_reserve_" + i);
                        thisGame.reserveOnMouseDown(element, thisGame.event("reserveOnMouseDown(this,event,#)"), i);
                        return true;
                    }
                    if (unitType && reserveUnits[i] !== unitType )
                    {
                        continue;
                    } 
                }
                return (!unitType || reserveUnits[i] === unitType) ? true : false;
            }
        }
    }
    return false;
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
            const civPiece = thisGame.pieces.findAtPoint(civBoardPoint);
            if ((waterPopup && isEarlyGame) || (waterPopup && (Math.random() < 0.2)))
            {
                thisGame.swapWaterForLand();
                komputerLog("Water swap!");
            }
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
            }, getTurbo(600));
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
    const delay = thisGame.previewing ? getTurbo(800) : 1600;
    setTimeout(function()
    {
        if (!playingNextTurn(thisGame))
        {
            window.isKomputerReady = true;
            resetKomputerButtonStyle();
            komputerLog("Done.");
        };
    }, delay)
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
    // Return any closest vulnerable town point.
    let buildablePieces = [];
    markClosestToEnemy(thisGame, buildablePoints);
    for (const point of buildablePoints)
    {
        const piece = thisGame.pieces.findAtPoint(point);
        if (piece.hasTown(thisGame.perspectiveColor) && await isVulnerable(thisGame, piece))
        {
            return point;
        }
        buildablePieces.push(piece);
    }
    // Check for pinned towns to support via build on nearby forest.
    let pinAdjacentPoints = [];
    for (const civ of playerCivs)
    {
        const isPinned = (hasAdjacentEnemyArmy(thisGame, civ) || hasAdjacentEnemyFrigate(thisGame, civ));
        if (!isPinned)
        {
            continue;
        }
        const maySupport = hasAdjacentWater(thisGame, civ) && !hasAdjacentFrigate(thisGame, civ, thisGame.perspectiveColor);
        if (maySupport && await isVulnerable(thisGame, civ))
        {
            const pinAdjacentIndecies = civ.getAdjacentIndecies(1);
            for (const index of pinAdjacentIndecies)
            {
                const pinAdjacentPiece = thisGame.pieces[index];
                if (pinAdjacentPiece.isWater())
                {
                    pinAdjacentPoints.push(pinAdjacentPiece.boardPoint.clone());
                }
            }
        } 
    }
    if (pinAdjacentPoints.length)
    {
        for (let buildIndex = 0; buildIndex < buildablePieces.length; buildIndex++)
        {
            const buildPiece = buildablePieces[buildIndex];
            if (buildPiece.isForest() && buildPiece.hasTown(thisGame.perspectiveColor) && hasAdjacentWater(thisGame, buildPiece))
            {
                const buildAdjacentIndecies = buildPiece.getAdjacentIndecies(1);
                for (const buildAdjacentIndex of buildAdjacentIndecies)
                {
                    const buildAdjacentPoint = thisGame.pieces[buildAdjacentIndex].boardPoint.clone();
                    for (const pinAdjacentPoint of pinAdjacentPoints)
                    {
                        if (pinAdjacentPoint.equals(buildAdjacentPoint))
                        {
                            return buildablePoints[buildIndex];
                        }
                    }
                }
            }
        }
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
    const centerPoint = getCenterPiecePoint(thisGame);
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
    let reservables = thisGame.pieces.getReservables(thisGame.player.team.color,thisGame.player.team.rulerColor, movingUnitType, controlsCapital);
    removePlaceHolders(reservables);
    // First turn: set infantry in town with adjacent smooth terrain.
    const isFirstTurn = thisGame.maxMoveNumber < 8;
    if (isFirstTurn)
    {
        const reservable = findFirstTurnReservable(thisGame, reservables);
        if (reservable)
        {
            return reservable;
        }
    }
    const isFrigate = movingUnitType === "f";
    return isFrigate ? getBestFrigateReservable(thisGame, reservables) : await getBestLandReservable(thisGame, reservables);
}


function removePlaceHolders(reservables)
{
    for (let i = reservables.length -1; i >= 0; i--)
    {
        if (reservables[i].placeHolderOnly)
        {
            reservables.splice(i, 1);
        }
    }
}


function pushCapitalToEnd(thisGame, reservables)
{
    const capitalPoint = thisGame.pieces.findCapitalPiece(thisGame.perspectiveColor).boardPoint.clone();
    for (let i = reservables.length -1; i >= 0; i--)
    {
        if (reservables[i].equals(capitalPoint))
        {
            reservables.push(reservables.splice(i,1)[0]);
        }
    }
}


function getBestFrigateReservable(thisGame, reservables)
{
    markClosestToEnemy(thisGame, reservables, false);
    let closestReservables = getAllClosestReservables(reservables);
    if (closestReservables.length > 1)
    {
        scoreFrigateReservables(thisGame, closestReservables);
        return getMaxScoreReservable(closestReservables);
    }
    return closestReservables[0];
}


function getAllClosestReservables(reservables)
{
    let closestReservables = [];
    let minDistance = Number.MAX_VALUE;
    for (let reservable of reservables)
    {
        if (reservable.minDistanceToEnemy < minDistance)
        {
            closestReservables = [];
            closestReservables.push(reservable);
            minDistance = reservable.minDistanceToEnemy;
        }
        else if (reservable.minDistanceToEnemy === minDistance)
        {
            closestReservables.push(reservable);
        }
    }
    return closestReservables;
}


function scoreFrigateReservables(thisGame, reservables)
{
    for (let reservable of reservables)
    {
        const piece = thisGame.pieces.findAtPoint(reservable);
        const enemyColor = piece.getOpponentColor(thisGame.perspectiveColor);
        const primaryTargetColors = window.primaryTargetColors ? window.primaryTargetColors : decidePrimaryTargetColors(thisGame);
        reservable.score = getFrigateMoveScore(thisGame, piece, null, enemyColor, primaryTargetColors);
    }
}


function getMaxScoreReservable(reservables)
{
    let maxScore = Number.MIN_VALUE;
    let best = null;
    for (const reservable of reservables)
    {
        if (reservable.score > maxScore)
        {
            maxScore = reservable.score;
            best = reservable;
        }
        else if ((reservable.score === maxScore) && (Math.random() < 0.5))
        {
            best = reservable;
        }
    }
    return best;
}


async function getBestLandReservable(thisGame, reservables)
{
    markClosestToEnemy(thisGame, reservables);
    pushCapitalToEnd(thisGame, reservables);
    // Guard any empty threatened town.
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
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    const topCenterIndex = window.isSmallBoard ? 51 : playerCount === 2 ? 79 : null;
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


function markClosestToEnemy(thisGame, points, sort = true)
{
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
    for (let point of points)
    {
        let minDistanceToArmy = Number.MAX_VALUE;
        for (const enemyArmy of enemyArmies)
        {
            const enemyPoint = enemyArmy.piece.boardPoint.clone();
            const distanceToArmy = thisGame.distanceBewteenPoints(point, enemyPoint);
            if (distanceToArmy < minDistanceToArmy)
            {
                minDistanceToArmy = distanceToArmy
                point.minDistanceToEnemy = distanceToArmy;
            }
        }
    }
    if (sort)
    {
        points.sort(function(a, b){ return a.minDistanceToEnemy - b.minDistanceToEnemy });
    }
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
            await counterThreats(thisGame, armyUnits);
            armyUnits = getArmyUnits(thisGame, [thisGame.perspectiveColor]);
            await counterGraveDanger(thisGame, armyUnits);
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
                            komputerLog("Cavalry recall failed. Logging unit and target point.");
                            komputerLog(unit);
                            komputerLog(reservablePoint);
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
        if (isLoneCivDefender(thisGame, unit) && (hasDarkFrontierTown(thisGame, unit.piece) || await hasThreat(thisGame, unit.piece)))
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
                        komputerLog("Troop recall failed. Will log unit and target point.");
                        komputerLog(unit);
                        komputerLog(reservablePoint);
                    }
                    break;
                }
            }
        }
    }
}


function hasDarkFrontierTown(thisGame, civPiece)
{
    if (civPiece.hasCity(thisGame.perspectiveColor))
    {
        return false;
    }
    const homePoints = thisGame.getCapitalPoints(thisGame.info.board, thisGame.perspectiveColor, thisGame.playOptions, false);
    for (const point of homePoints)
    {
        if (civPiece.boardPoint.equals(point))
        {
            return false;
        }
    }
    const adjacentIndecies = civPiece.getAdjacentIndecies(2);
    for (const adjacentIndex of adjacentIndecies)
    { 
        let adjacentPiece = thisGame.pieces[adjacentIndex];
        if (adjacentPiece.isDark && !thisGame.getMemoryUnits(adjacentPiece.index).length)
        {
            return true;
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
                        komputerLog("Troop recall failed. Logging unit and target point.");
                        komputerLog(unit);
                        komputerLog(reservablePoint);
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
                    const maySupport = hasAdjacentWater(thisGame, civPiece) && !hasAdjacentFrigate(thisGame, civPiece, thisGame.perspectiveColor);
                    if (isPinned && maySupport)
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
        targetPoint.score += hasAdjacentFriendlyArmy(thisGame, targetPiece, thisGame.perspectiveColor) ? 0.25 : 0;
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
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    thisGame.maxMoveNumber = thisGame.maxMoveNumber < (4 * playerCount) ? thisGame.maxMoveNumber : 0;
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
        const shortDelay = getTurbo(400);
        const longDelay = getTurbo(700);
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
                    const controlsCapital = thisGame.doesColorControlTheirCapital(thisGame.player.team.color);
                    const hasReserveUnit = getHasPlayableReserveUnit(thisGame, controlsCapital, false);
                    // Player 1 normally ends here.
                    if (!hasReserveUnit)
                    {
                        thisGame.endMyTurn();
                        const endTurnDelay = thisGame.previewing ? getTurbo(300) : 1600;
                        setTimeout(function()
                        {
                            if (!playingNextTurn(thisGame))
                            {
                                window.isKomputerReady = true;
                                resetKomputerButtonStyle();
                                komputerLog("Done.");
                            };
                        }, endTurnDelay);
                    }
                    // Player places additional town based on specific data. Later reserve phases use other guidance.
                    else
                    {
                        if (thisGame.movePhase === 11)
                        {
                            if (playerCount < 4)
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
                                        const endTurnDelay = thisGame.previewing ? getTurbo(300) : 1600;
                                        setTimeout(function()
                                        {
                                            if (!playingNextTurn(thisGame))
                                            {
                                                window.isKomputerReady = true;
                                                resetKomputerButtonStyle();
                                                komputerLog("Done.");
                                            }
                                        }, endTurnDelay)
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
                                        const endTurnDelay = thisGame.previewing ? getTurbo(shortDelay) : 1600;
                                        setTimeout(function()
                                        {
                                            if (!playingNextTurn(thisGame))
                                            {
                                                window.isKomputerReady = true;
                                                resetKomputerButtonStyle();
                                                komputerLog("Done.");
                                            }
                                        }, endTurnDelay)
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
    }, getTurbo(1000))
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
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
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
        const activeEnemyColor = getRandomItem(activeEnemyColors);
        const enemyColor = activeEnemyColor !== null ? activeEnemyColor : getRandomItem(enemyColors);
        const enemyCapitalPiece = thisGame.pieces.findCapitalPiece(enemyColor);
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


function findAdjacentEnemyCivs(thisGame, piece)
{
    let adjacentCivs = [];
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        if (!adjacentPiece || adjacentPiece.hidden || (adjacentPiece.isDark && !thisGame.getMemoryUnits(adjacentPiece.index).length))
        {
            continue;
        }
        if (adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor))
        {
            adjacentCivs.push(adjacentPiece);
        }
    }
    return adjacentCivs;
}


function findAdjacentEnemyTowns(thisGame, piece)
{
    let adjacentTowns = [];
    const adjacentIndecies = piece.getAdjacentIndecies(1);
    for (const adjacentIndex of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[adjacentIndex];
        if (!adjacentPiece || adjacentPiece.hidden || (adjacentPiece.isDark && !thisGame.getMemoryUnits(adjacentPiece.index).length))
        {
            continue;
        }
        if (adjacentPiece.hasOpponentTown(thisGame.perspectiveColor))
        {
            adjacentTowns.push(adjacentPiece);
        }
    }
    return adjacentTowns;
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
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentCivilization(thisGame.perspectiveColor) && !adjacentPiece.hidden);
}


function hasAdjacentEnemyTown(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentTown(thisGame.perspectiveColor) && !adjacentPiece.hidden);
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
        const isHidden = (adjacentPiece && adjacentPiece.hidden);
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


function isAccessibleNow(piece, unit, viaCargo = false, allowFrigateBattle = true, loadData = null)
{
    if (!piece || !unit)
    {
        return false;
    }
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
        for (const targetPoint of unitMovablePoints)
        {
            if (!targetPoint.equals(piece.boardPoint))
            {
                continue;
            }
            if (allowFrigateBattle)
            {
                if (loadData)
                {
                    loadData.index = targetPoint.retreatIndex; 
                    loadData.spacesNeeded = targetPoint.spacesNeeded;
                    loadData.possibleMoves = unitMovablePoints;
                }
                return true;
            }
            else
            {
                const unloadingPiece = piece.pieces[targetPoint.retreatIndex];
                if (!unloadingPiece.hasOpponentUnit(unit.color, "f"))
                {
                    if (loadData)
                    {
                        loadData.index = targetPoint.retreatIndex; 
                        loadData.spacesNeeded = targetPoint.spacesNeeded;
                        loadData.possibleMoves = unitMovablePoints;
                    }
                    return true;
                }
                else
                {
                    const alternatePoints = unit.getMovables();
                    for (const alternatePoint of alternatePoints)
                    {
                        if (alternatePoint.index === unloadingPiece.index)
                        {
                            continue;
                        }
                        const altUnloadingPiece = piece.pieces[alternatePoint.index];
                        if (altUnloadingPiece.hasOpponentUnit(unit.color, "f"))
                        {
                            continue;
                        }
                        if (piece.pieces.game.distanceBewteenPoints(targetPoint, alternatePoint) === 1)
                        {
                            if (loadData)
                            {
                                loadData.index = altUnloadingPiece.index; 
                                loadData.spacesNeeded = alternatePoint.spacesNeeded;
                                loadData.possibleMoves = alternatePoints;
                            }
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
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasFrigate(color) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasFrigate(color) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasFrigate(color) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasFrigate(color) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasFrigate(color) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasFrigate(color) && !adjacentPiece.hidden);
}


function hasAdjacentEnemyFrigate(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"f") && !adjacentPiece.hidden);
}


function hasAdjacentEnemyArtillery(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a") && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasOpponentUnit(thisGame.perspectiveColor,"a") && !adjacentPiece.hidden);
}


function hasAdjacentEnemyArmy(thisGame, piece)
{
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && hasEnemyArmy(thisGame, adjacentPiece) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && hasEnemyArmy(thisGame, adjacentPiece) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && hasEnemyArmy(thisGame, adjacentPiece) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && hasEnemyArmy(thisGame, adjacentPiece) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && hasEnemyArmy(thisGame, adjacentPiece) && !adjacentPiece.hidden) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && hasEnemyArmy(thisGame, adjacentPiece) && !adjacentPiece.hidden);
}


function hasAdjacentFriendlyArmy(thisGame, piece, color)
{
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
        if (piece.hidden || piece.isDark || piece.isWater() || piece.valueIndex === reserveIndex)
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


function shuffleText(string)
{
    // Schwartzian - split string, map each value to a random value, sort by each value, rejoin.
    return string.split("").map(v => [v, Math.random()]).sort((a, b) => a[1] - b[1]).map(v => v[0]).join("");
}


function shuffle(array) 
{
    // Durstenfeld - backwards iterating random swaps of an array in place.
    for (let i = array.length - 1; i > 0; i--) 
    {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
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
    let bestOrigins = [];
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
            bestOrigins.push(origin);
        }
    }
    if (bestOrigins.length > 1)
    {
        for (const origin of bestOrigins)
        {
            if (!origin.hasFrigate(thisGame.perspectiveColor))
            {
                return origin;
            }
        }
        return getRandomItem(bestOrigins);
    }
    if (bestOrigins.length === 0)
    {
        return getRandomItem(possibleOrigins);
    }
    return bestOrigins[0];
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
function getKomputerMovables(unit)
{
   var movables=new Array();
   var allowance=unit.movementAllowance-unit.spacesMoved;
   unit.piece.pieces.setRecursionFlag("bestAllowance",-1);
   if (unit.isFrigate())
   {
      if (!unit.movementComplete)
         addKomputerFrigateMovables(unit, movables,unit.piece.boardPoint.x,unit.piece.boardPoint.y,allowance,0,false,-1);
      if (unit.hasUnloadables())
         unit.addUnloadMoveables(movables);
   }
   else
   {
      addKomputerLandMovables(unit, movables,unit.piece.boardPoint.x,unit.piece.boardPoint.y,allowance,0,-1);
      if (unit.spacesMoved==0)
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
    GamesByEmail.Viktory2Unit.prototype.setVisibility = function(visible)
    {
        if (!this || !this.piece)
        {
            return;
        }
        let element = this.getElement();
        if (element)
        {
            element.style.visibility=(visible ? "visible" : "hidden");
            for (var i=0;i<this.cargo.length;i++)
            {
                this.getElement(i).style.visibility=(visible ? "visible" : "hidden");
            }
        }
    }


    // Support clip rectangles for nation sprites. 
    GamesByEmail.Viktory2Unit.prototype.getClipRect = function (hilite,piece,loaded)
    {
        swapColorForMask(this);
       if (!piece)
          piece=this.piece;
       var rect;
       if (this.isColorBlind && this.isMilitary())
          rect=piece.pieces.game.board.unitRects[this.type+(loaded ? "c" : "F")].clone();
       else
          rect=piece.pieces.game.board.unitRects[this.type+(loaded ? "c" : (this.movementComplete || this.showStationary ? (this.hasBombarded ? "b" : "F") : ""))].clone();
       if (this.color > 17)
        {
            rect.x = rect.x + 600;
        } 
       else if (this.color > 8)
        {
            rect.x = rect.x + 300;
        } 
       if (this.color>0 || this.isColorBlind)
        {
            rect.add(piece.pieces.game.board.unitRects['co'].clone().scale(this.isColorBlind ? 8 :  this.color % 9));
        }
       if (hilite)
          rect.add(piece.pieces.game.board.unitRects['ho']);
       revertColorFromMask(this);
       return rect;
    }


    GamesByEmail.Viktory2Unit.prototype.getCargoClip = function(unitType,hilite)
    {
        swapColorForMask(this);
       var rect=this.piece.pieces.game.board.unitRects[unitType.toLowerCase()+"c"].clone();
       if (this.color > 17)
        {
            rect.x = rect.x + 600;
        } 
       else if (this.color > 8)
        {
            rect.x = rect.x + 300;
        } 
       if (this.color>0 || this.isColorBlind)
          rect.add(this.piece.pieces.game.board.unitRects['co'].clone().scale(this.isColorBlind ? 8 :  this.color % 9));
       if (hilite)
          rect.add(this.piece.pieces.game.board.unitRects['ho']);
       revertColorFromMask(this);
       return rect;
    }


    GamesByEmail.Viktory2Unit.prototype.unloadCargo = function(piece,update)
    {
       var unitType=this.getActiveCargoType();
       this.cargo=this.cargo.substr(0,this.activeCargoIndex)+this.cargo.substr(this.activeCargoIndex+1);
       if (piece)
       {
          this.cargoUnloaded++;
          this.disembarkIndex=piece.index;
          this.movementComplete=true;
          var unit=piece.addUnit(this.color,unitType);
          unit.placedThisTurn=false;
          unit.movementComplete=true;
          unit.noBombard=true;
          unit.retreatIndex=this.piece.index;
          if (window.KomputerNations.isActive)
        {
            unit.maskColor = getSelectedMaskColor(unit);
        }
          if (update)
             piece.updateUnitDisplay();
       }
       if (update)
          this.piece.updateUnitDisplay();
       return unitType;
    }


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

    GamesByEmail.Viktory2Unit.prototype.addLandMovables = function (movables,x,y,allowance,distance,retreatIndex)
    {
      var piece=this.piece.pieces.findAtXY(x,y);
      if (piece && !piece.hidden && allowance>piece.bestAllowance && piece.isLand())
      {
         if (distance>0)
            piece.pushMoveable(movables,this.color,this.rulerColor,distance,retreatIndex);
         retreatIndex=piece.index;
         piece.bestAllowance=allowance;
         if (allowance>0 &&
             piece.allAdjacentsVisible() &&
             !piece.hasRollingEnemy(this.color,this.rulerColor) &&
             (distance==0 || this.ignoresSlowTerrain() || !piece.isSlowTerrain(this.color,this.rulerColor)))
         {
            allowance--;
            distance++;
            var roads= piece.getRoadsOut(this.color,this.rulerColor,allowance);  
            for (var i=0;i<roads.length;i++)
               this.addLandMovables(movables,roads[i].x,roads[i].y,allowance,distance,retreatIndex);
            this.addLandMovables(movables,x-1,y,allowance,distance,retreatIndex);
            this.addLandMovables(movables,x+1,y,allowance,distance,retreatIndex);
            this.addLandMovables(movables,x,y-1,allowance,distance,retreatIndex);
            this.addLandMovables(movables,x,y+1,allowance,distance,retreatIndex);
            this.addLandMovables(movables,x-1,y-1,allowance,distance,retreatIndex);
            this.addLandMovables(movables,x+1,y+1,allowance,distance,retreatIndex);
            recycleArray(roads);
         }
      }
   }
}


function patchPiecesPrototype(thisGame)
{
    GamesByEmail.Viktory2Pieces.prototype.updateUnitDisplays = function ()
    {
        if (window.KomputerNations.isActive)
        {
            const menuOptions = window.KomputerNations.menuOptions;
            const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
            const maxNationCount = playerCount;
            for (let color = 0; color < maxNationCount; color++)
            {
                const selector = document.getElementById("NationSelector_" + color);
                const originColor = selector.value * 1;
                const maskColor = window.KomputerNations[menuOptions[selector.selectedIndex]];
                for (let i = 0; i < this.length; i++)
                {
                    let piece = this[i];
                    for (let unit of piece.units)
                    {
                        if (unit.color === originColor)
                        {
                            unit.maskColor = maskColor;
                        }
                    }
                }
            }
        }
        for (let i = 0; i < this.length; i++)
        {
            let piece = this[i];
            piece.updateUnitDisplay();
        }
    }
    thisGame.pieces.updateUnitDisplays = GamesByEmail.Viktory2Pieces.prototype.updateUnitDisplays;
}


function getReusableArray()
{
    return window.Komputer.arrayPool.length ? window.Komputer.arrayPool.pop() : [];
}

function recycleArray(target)
{
    if (!target || !target.length)
    {
        return;
    }
    target.length = 0;
    window.Komputer.arrayPool.push(target);
}


function patchPiecePrototype()
{
    GamesByEmail.Viktory2Piece.prototype.getRoadsOut = function(color,rulerColor,allowance)
    {
      var roads= getReusableArray(); 
      if (this.hasAllianceCivilization(color,rulerColor))
      {
         var civs=this.pieces.getAllianceCivilizations(color,rulerColor);
         for (var i=0;i<civs.length;i++)
            if (allowance>civs[i].bestAllowance &&
                this.minDistanceTo(civs[i],3,true,true,color,rulerColor)>0)
               roads.push(civs[i].boardPoint);
      }
      return roads;
    }

    // Patch for nation sprites: add color mask when adding new units.
    GamesByEmail.Viktory2Piece.prototype.addUnit = function(color,type)
    {
       var unit=new GamesByEmail.Viktory2Unit(this,this.units.length,color,type);
       unit.placedThisTurn=true;
       this.units.push(unit);
       unit.maskColor = getSelectedMaskColor(unit);
       return unit;
    }


    // Patch to unload units with nation sprites.
    GamesByEmail.Viktory2Piece.prototype.centerUnload = function(unitType,color,screenPoint)
    {
       for (var i=0;i<this.movingUnit.cargo.length;i++)
          this.getElement("cargo_"+i).style.visibility="hidden";
       var e=this.getElement();
       var clipRect=this.pieces.game.board.unitRects[unitType+"F"].clone();
       if (window.KomputerNations.isActive && (typeof(color) === "number") && color < 8)
        {
            const maskColor = getSelectedMask(color)
            if (maskColor > 17)
            {
                clipRect.x = clipRect.x + 600;
            } 
            else if (maskColor > 8)
            {
                clipRect.x = clipRect.x + 300;
            } 
            color = maskColor;
        }
       if (color % 9 > 0)
          clipRect.add(this.pieces.game.board.unitRects['co'].clone().scale(color % 9));
       GamesByEmail.positionImage(e,screenPoint,clipRect);
       e.style.visibility="visible";
    }


    // Patch for nation sprites: add color mask for conquered civ.
    GamesByEmail.Viktory2Piece.prototype.conquer = function(color,update)
    {
       var won=false;
       this.removeOpponentPennants(color);
       var civ=this.findOpponentCivilization(color);
       if (civ)
       {
          this.maybeStartDoomsdayClock(civ);
          var cc=civ.color;
          civ.color=color;
          civ.isColorBlind=false;
          civ.maskColor = getSelectedMaskColor(civ);
          this.pieces.game.removeExcessPieces(cc,true);
          this.pieces.game.maybeUndarkAdjacent(this.boardPoint,civ.isCity() ? 2 : 1);
          if (this.pieces.getScore(cc)==0)
          {
             var team=this.pieces.game.teams.findTeamByColor(cc);
             if (!team.status.resigned)
                team.notify.lost=true;
             team.status.inPlay=false;
             won=this.pieces.game.checkForWin(true);
          }
          if (!won &&
              this.pieces.game.playOptions.shorterConquest &&
              this.hasCapital(cc))
          {
             this.pieces.game.setEconomicVictors(cc);
             won=true;
          }
       }
       for (var i=0;i<this.units.length;i++)
          if (this.units[i].isBombarder())
             this.units[i].hasBombarded=true;
       if (update)
          this.updateUnitDisplay();
       return won;
    }

    // Adds a check for array before accessing. 
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
        const key = ["x", p1.x, "y", p1.y, "x", p2.x, "y", p2.y].join('');  
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


function hidePrimaryControls()
{
    let runButton = document.getElementById("KomputerButton_" + GameVersion);
    let stopButton = document.getElementById("StopKomputerButton_" + GameVersion);
    let darkModeToggle = document.getElementById("DarkModeToggle_" + GameVersion);
    let darkModeLabel = document.getElementById("DarkModeLabel_" + GameVersion);
    let soundToggle = document.getElementById("SoundToggle_" + GameVersion);
    let soundToggleLabel = document.getElementById("SoundToggleLabel_" + GameVersion);
    let turboToggle = document.getElementById("TurboToggle_" + GameVersion);
    let turboToggleLabel = document.getElementById("TurboToggleLabel_" + GameVersion);
    let komputerOptions = document.getElementById("KomputerOptions");
    runButton.style.visibility = "hidden"; 
    stopButton.style.visibility = "hidden";
    darkModeToggle.style.visibility = "hidden"; 
    darkModeLabel.style.visibility = "hidden"; 
    soundToggle.style.visibility = "hidden";
    soundToggleLabel.style.visibility = "hidden";
    turboToggle.style.visibility = "hidden";
    turboToggleLabel.style.visibility = "hidden";
    komputerOptions.style.visibility = "hidden";
}


function patchGamePrototype(thisGame)
{
    // Starting a new game disables custom nations and game editor, updates their position.  
    GamesByEmail.Viktory2Game.prototype.startAnotherGame = function()
    {
       disableGameEditor();
       disableNations();
       var formLoader=new Foundation.ClientLoader();
       formLoader.readyToProcess=new Function(this.event("showStartAnotherGameForm(null)"));
       formLoader.receiveScriptList([{test:"typeof(GamesByEmail.GameForm)=='undefined'",src:this.getCodeFolder()+"GamesByEmail.GameForm.js?"+(new Date()).valueOf()},
                                     {test:"GamesByEmail.GameForm.$classFromNameHint('"+this.resource("gameFolder")+"')==null",src:this.getCodeFolder(true)+"GameForm.js?"+(new Date()).valueOf()}]);
       this.requestNewGameUserInfo();
       setTimeout(function()
        {
            let form = document.getElementById("MultiplayerForm");
            let msgBox = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameMessageWrite"); //document.getElementById("Foundation_Elemental_11_GameTitle");
            form.style.position = "absolute";
            form.style.top = msgBox.getBoundingClientRect().bottom + window.scrollY - 5;
            selectDefaultPlayerCount(); 
            hideDefaultPlayControls()
            hidePrimaryControls();
            hideGameEditor();
            hideNationsDiv();
        }, 1600);
    }

    // Adds support for nation sprites.
    GamesByEmail.Viktory2Game.prototype.getUnitImageHtml = function(unitType,color,attributes)
   {
    var clipRect=this.board.unitRects[unitType].clone();
    if (window.KomputerNations.isActive && (typeof(color) === "number") && color < 8)
    {
        const maskColor = getSelectedMask(color)
        if (maskColor > 17)
        {
            clipRect.x = clipRect.x + 600;
        } 
        else if (maskColor > 8)
        {
            clipRect.x = clipRect.x + 300;
        } 
        color = maskColor;
    }
      if (color % 9 > 0)
         clipRect.add(this.board.unitRects['co'].clone().scale(color % 9));
      return GamesByEmail.clippedImageHtml(this.getUnitImageSrc(),clipRect,null,attributes ? attributes : null);
   }

   // Adds source for nation sprites.
    GamesByEmail.Viktory2Game.prototype.getUnitImageSrc = function ()
    {
        if (window.KomputerNations.isActive)
        {
            return window.KomputerNations.path + "Units_16_nations.png";
        }
        else
        {
            return this.getImageSrc(this.board["unitImage"+this.altUnits]);
        }
    }


    GamesByEmail.Viktory2Game.prototype.updateTeamTitles = function ()
    {
        if (window.KomputerNations.isActive)
        {
            renameTeams(this, true);
        }
        else
        {
            renameTeams(this, false);
        }
        this.setInnerHtml("topTeamTitles",this.getTeamTitlesHtml(true));
        this.setInnerHtml("bottomTeamTitles",this.getTeamTitlesHtml(false));
    }


    thisGame.getUnitImageSrc = GamesByEmail.Viktory2Game.prototype.getUnitImageSrc;
    thisGame.getUnitImageHtml = GamesByEmail.Viktory2Game.prototype.getUnitImageHtml;
    thisGame.updateTeamTitles = GamesByEmail.Viktory2Game.prototype.updateTeamTitles;


    GamesByEmail.Viktory2Game.prototype.reserveOnMouseDown = function (element,event,index)
    {
       if(event.preventDefault)
          event.preventDefault();
       this.maybeHideOverlay();
       var controlsCapital=this.doesColorControlTheirCapital(this.player.team.color);
       var unitType=this.player.team.reserveUnits.charAt(index);
       var messageHtml=null;
       this.movingReserveIndex=-2;
       if (!(messageHtml=this.anyBattlesPending()))
          if (controlsCapital || unitType=="i")
             if (this.setTargetPoints(unitType=="t" ? this.getBuildables(this.player.team.color,this.player.team.rulerColor) : this.pieces.getReservables(this.player.team.color,this.player.team.rulerColor,unitType,controlsCapital)))
             {
                this.movingReserveIndex=index;
                this.onMouseMove="placeReserveOnMouseMove";
                this.onMouseUp="placeReserveOnMouseUp";
                var e=this.getElement("mouse");
                if (e.setCapture) 
                  e.setCapture(true);
                var screenPoint=GamesByEmail.Game.$mousePoint(event,e);
                this.getElement("reserve_"+this.movingReserveIndex).style.visibility="hidden";
                var movingPiece=this.pieces.getNewPiece();
                movingPiece.setMovingUnit(new GamesByEmail.Viktory2Unit(null,-1,this.player.team.color,unitType));
                movingPiece.movingUnit.maskColor = getSelectedMaskColor(movingPiece.movingUnit);
                movingPiece.center(this.constrainPoint(screenPoint).subtract(0,5));
                messageHtml="";
                if (this.movePhase<11)
                   messageHtml+=this.resource("thisWillEndMovementAndCombatPhaseHtml");
                messageHtml+=this.reservePlacementHtml(unitType);
                if (messageHtml.length==0)
                   messageHtml=null;
             }
             else
                if (unitType=="t")
                   if (this.teams.length<=6 &&
                       this.player.team.color==0 &&
                       this.move.number<=3)
                      messageHtml=this.resource("onlyOneTownForFirstTeamOnTwoPlayersHtml");
                   else
                      messageHtml=this.resource("noPlaceToBuildHtml");
                else
                   messageHtml=this.resource("noPlaceToPutReserveUnitHtml");
          else
             if (unitType=="t")
                messageHtml=this.resource("youDoNotControlCapitalToBuildHtml");
             else
                messageHtml=this.resource("youDoNotControlCapitalToPlaceUnitsHtml");
       if (messageHtml)
          this.showReserveMessage(new Foundation.Point(this.board.image.size.x/2,this.board.image.size.y),messageHtml);
    }


    // Appends game update to ensure the End Turn message shows for all cases. 
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
        this.update();
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

    // Adds button position resets on end turn, for slow and fast response.
    GamesByEmail.Viktory2Game.prototype.endMyTurn = function()
    {
        if (!this.battlesPendingAlert("EndTurn") &&
            this.confirmEndReservePlacement("EndTurn"))
        {
            this.moveToNextPlayer();
            this.sendMove();
            setTimeout(function(){ resetButtonPositions() }, 100);
            setTimeout(function(){ resetButtonPositions() }, 3000);
        }
        else
            this.getElement("endMyTurn").disabled=false;
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
         playSound("move_" + getMovingUnitType(movingPiece.movingUnit));
         window.lastTargetPoint = boardPoint;
         var targetPiece=this.pieces.findAtPoint(boardPoint);
         if (movingPiece.movingUnit.isLandUnit() &&
             targetPiece.isWater())
         {
            var oldPiece=movingPiece.movingUnit.piece;
            var loadableUnit=this.militaryUnitFromScreenPoint(screenPoint,null,movingPiece.movingUnit.color,movingPiece.movingUnit.rulerColor,false,false,true);
            var log=this.logEntry(7,oldPiece.index,oldPiece.boardValue,targetPiece.index,targetPiece.boardValue,movingPiece.movingUnit.type,loadableUnit.type);
            if (window.KomputerNations.isActive)
            {
                loadableUnit.maskColor = getSelectedMaskColor(loadableUnit);
            }
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
         if (window.KomputerNations.isActive)
         {
            movingUnit.maskColor = getSelectedMaskColor(movingUnit);
         }
         if (movingUnit.isMilitary(movingUnit.color))
        {
            playSound("place_" + getMovingUnitType(movingUnit));
        }
        else
        {
            playSound("buildCiv");
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
                if (window.KomputerNations.isActive)
                {
                    playCavalryBattle(piece);
                }
                else
                {
                    playSound("battleCavalry");
                }
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
            if (window.KomputerNations.isActive)
            {
                playCavalryBattle(piece);
            }
            else
            {
                playSound("battleCavalry");
            }
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
            if (window.KomputerNations.isActive)
            {
                playCavalryBattle(piece);
            }
            else
            {
                playSound("battleCavalry");
            }
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
         if ((this.teams[i].status.inPlay || this.teams[i].status.won) &&
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
            setTimeout( function(){ handleWinState() }, 200 );
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
    let style = {position: 'absolute', top: getRunButtonTop(), left:'24px', 'z-index': '9999', "-webkit-transition-duration": "0.6s", "transition-duration": "0.6s", overflow: 'hidden', width: '102px', 'font-size': '10px'}
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
    makeNonSelectable(toggleLabel);
    toggleLabel.id = "DarkModeLabel_" + GameVersion;
    toggleLabel.htmlFor = "DarkModeToggle_" + GameVersion;
    toggleLabel.innerText = "Dark";  
    style = {position: 'absolute', top: getDarkModeToggleLabelTop(), left:'107px', 'z-index': '9999', 'font-size': '8px'};
    Object.keys(style).forEach(key => toggleLabel.style[key] = style[key]);
    document.body.appendChild(toggleLabel);
}


function getRunButtonTop()
{
    const teamTitlesTop = window.scrollY + document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles').getBoundingClientRect().top;
    if (window.isExtraLargeBoard)
    {
        return teamTitlesTop - 71;
    }
    return teamTitlesTop;
}


function getSoundToggleTop()
{
    return getRunButtonTop();
}


function getSoundToggleLabelTop()
{
    return getRunButtonTop() + 4;
}


function getStopButtonTop()
{
    return getRunButtonTop() + 20;
}


function getDarkModeToggleTop()
{
    return getRunButtonTop() + 18;
}


function getDarkModeToggleLabelTop()
{
    return getRunButtonTop() + 22;
}


function getTurboButtonTop()
{
    return getRunButtonTop() + 18;
}


function getTurboButtonLabelTop()
{
    return getRunButtonTop() + 22; //4;
}


function getTurboInfoTop()
{
    return getTurboButtonTop() - 36;
}


function stopKomputerClick()
{
    window.stopKomputer = true;
    styleButtonForStop();
    styleBoardForStop();
    setTimeout(function(){
        if (window.stopKomputer === true)
        {
            window.stopKomputer = false;
            resetStopKomputerButtonStyle();
            throw new Error(getErrorMessage());
        }
    }, 3000);
}


function getErrorMessage(verbose = false)
{
    const shortMessage = "Force Stop.";
    if (!verbose)
    {
        return shortMessage;
    }
    return "Force Stop. The Stop Button was pressed when it appears the Komputer was not running. \
If so, please ignore this message. If the game was hung, I apologize - feel free to send the error here: \n\
stephen.montague.viktory@gmail.com"
}


function stopAndReset(resetKomputerButton = true)
{
    clearIntervalsAndTimers();
    resetAllButtonStyles();
    styleBoardForStop();
    clearHoldingUnits();
    resetGlobals(resetKomputerButton);
    hideOptionsMenu();
    komputerLog("All Stop.");
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


function styleBoardForRun(color)
{
    // Add light halo to board.
    let boardSpace = document.getElementById("Foundation_Elemental_" + GameVersion + "_boardSpace");
    if (boardSpace)
    {
        const isGreen = (color === 2);
        let colorName = isGreen ? "lime" : GamesByEmail.Viktory2Game.resourcePack.teamTitles[color].toLowerCase();
        boardSpace.style.background = "radial-gradient(circle at top 51.25% left 50%, " + colorName + " 30%, transparent 72%)";  
    }
}


function styleBoardForStop()
{
    let boardSpace = document.getElementById("Foundation_Elemental_" + GameVersion + "_boardSpace");
    if (boardSpace)
    {
        boardSpace.style.background = "radial-gradient(circle at top 51.5% left 50%, lightblue 30%, transparent 72%)"; 
    }
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
    styleBoardForStop();
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
    let gameEditor = document.getElementById("GameEditor");
    let gameEditorToggle = document.getElementById("GameEditorToggle");
    let nationsDiv = document.getElementById("NationsDiv");
    let multiplayerForm = document.getElementById("MultiplayerForm");
    let soundToggle = document.getElementById("SoundToggle_" + GameVersion);
    let soundToggleLabel = document.getElementById("SoundToggleLabel_" + GameVersion);
    let turboToggle = document.getElementById("TurboToggle_" + GameVersion);
    let turboToggleLabel = document.getElementById("TurboToggleLabel_" + GameVersion);
    let turboToggleInfo = document.getElementById("TurboInfo_" + GameVersion);
    let komputerOptions = document.getElementById("KomputerOptions");
    const baseReference = document.getElementById('Foundation_Elemental_' + GameVersion + '_bottomTeamTitles');
    if (baseReference)
    {
        const baseTop = baseReference.getBoundingClientRect().top;
        if (baseTop === 0)
        {
            visible = false;
        }
    }
    if (visible && baseReference)
    {
        runButton.style.top = getRunButtonTop();
        stopButton.style.top = getStopButtonTop();
        darkModeToggle.style.top = getDarkModeToggleTop();
        darkModeLabel.style.top = getDarkModeToggleLabelTop();
        soundToggle.style.top = getSoundToggleTop(); 
        soundToggleLabel.style.top = getSoundToggleLabelTop(); 
        turboToggle.style.top = getTurboButtonTop();
        turboToggleLabel.style.top = getTurboButtonLabelTop();
        turboToggleInfo.style.top = getTurboInfoTop();
        nationsDiv.style.top = getNationsDivTop();
        nationsDiv.style.left = getNationsDivLeft();
        komputerOptions.style.top = getKomputerOptionsTop();
        runButton.style.visibility = ""; 
        stopButton.style.visibility = "";
        darkModeToggle.style.visibility = ""; 
        darkModeLabel.style.visibility = ""; 
        soundToggle.style.visibility = "";
        soundToggleLabel.style.visibility = "";
        turboToggle.style.visibility = "";
        turboToggleLabel.style.visibility = "";
        turboToggleInfo.style.visibility = "hidden";
        nationsDiv.style.visibility = "";
        komputerOptions.style.visibility = "";
        if (isOnPreviewTab())
        {
            if (gameEditor && gameEditorToggle)
            {
                gameEditor.style.top = getGameEditorTop();
                gameEditor.style.left = getGameEditorLeft();
                gameEditor.style.visibility = ""; 
                gameEditorToggle.style.visibility = ""; 
            }
            if (multiplayerForm)
            {
                multiplayerForm.style.top = getMultiplayerFormTop();
                multiplayerForm.style.left = getMultiplayerFormLeft();
                multiplayerForm.style.visibility = "";   
            }
        }
    }
    else  // Make invisible
    {
        runButton.style.visibility = "hidden"; 
        stopButton.style.visibility = "hidden";
        darkModeToggle.style.visibility = "hidden"; 
        darkModeLabel.style.visibility = "hidden"; 
        if (gameEditor && gameEditorToggle)
        {
            gameEditor.style.visibility = "hidden"; 
            gameEditorToggle.style.visibility = "hidden"; 
        }
        if (nationsDiv)
        {
            nationsDiv.style.visibility = "hidden";
        }
        if (multiplayerForm)
        {
            multiplayerForm.style.visibility = "hidden";   
        }
        soundToggle.style.visibility = "hidden";
        soundToggleLabel.style.visibility = "hidden";
        turboToggle.style.visibility = "hidden";
        turboToggleLabel.style.visibility = "hidden";
        turboToggleInfo.style.visibility = "hidden";
        komputerOptions.style.visibility = "hidden";
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
    // Add light halo to board.
    let boardSpace = document.getElementById("Foundation_Elemental_" + GameVersion + "_boardSpace");
    if (boardSpace)
    {
        if (window.isKomputerReady)
        {
            styleBoardForStop();
        }
        else
        {
            let thisGame = findGameForActiveTab();
            styleBoardForRun(thisGame.perspectiveColor);
        }
    }
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
    // Double check the footer.
    if (footer)
    {
        footer.style.backgroundColor = "#eeeeff";
    }
    // Remove halo from board.
    let boardSpace = document.getElementById("Foundation_Elemental_" + GameVersion + "_boardSpace");
    boardSpace.style.background = "";
    // Backup copy of content, for Game Editor or anything that might temporarily change backgroundColor.
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

/// === Game Editor ===

function addGameEditor(thisGame)
{
    if (thisGame.previewing && isOnPreviewTab())
    {
        const gameEditorDiv = document.createElement('div');
        gameEditorDiv.id = "GameEditor";
        gameEditorDiv.style.display = 'flex';
        gameEditorDiv.style.flexDirection = 'column';
        gameEditorDiv.style.position = "absolute";
        gameEditorDiv.style.top = getGameEditorTop();
        gameEditorDiv.style.left = getGameEditorLeft();
        gameEditorDiv.style.fontSize = "10px";
        gameEditorDiv.style.fontFamily = "Verdana";
        gameEditorDiv.style.padding = '4px';
        gameEditorDiv.innerText = "Game Editor";
        makeNonSelectable(gameEditorDiv);
        addGameEditorToggle(gameEditorDiv);
        window.isEditorInputSelected = {};
        const inputOptions = [
            {value: 'Plains'},
            {value: 'Grass'},
            {value: 'Forest'},
            {value: 'Mountain'},
            {value: 'Water'},
            {value: 'Capital'},
            {value: 'Settlement'},
            {value: 'Unit'},
            {value: 'Color'},
            {value: 'Visibility'},
            {value: 'Reset Changes'}
        ];
        inputOptions.forEach(option => {
            window.isEditorInputSelected[option.value] = false;
            const radioButtons = createRadioButton(option.value, editorInputListener, 'RadioGroup_GameEditor_');
            gameEditorDiv.appendChild(radioButtons);
        });
        document.body.appendChild(gameEditorDiv);
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
    makeNonSelectable(label);
    label.innerText = value;
    label.htmlFor = radioButton.id; 
    label.style.fontSize = '10px';
    label.style.fontFamily = 'Verdana';
    container.appendChild(radioButton);
    container.appendChild(label);
    addColorLabel(container, value);
    addUnitLabel(container, radioButton, value);
    return container;
}


function addColorLabel(container, value)
{
    if (value !== "Color")
    {
        return;
    }
    const color = 0;
    window.cacheColor = color;
    const colorLabel = document.createElement('label');
    makeNonSelectable(colorLabel);
    const colorText = GamesByEmail.Viktory2Game.resourcePack.teamTitles[color];
    colorLabel.innerText = colorText;
    colorLabel.id = "colorLabel";
    const fontColor = "thistle"; 
    colorLabel.style.color = fontColor;
    colorLabel.style.fontSize = "12px";
    colorLabel.style.fontFamily = "Verdana";
    colorLabel.style.textDecoration = "underline";
    colorLabel.style.marginLeft = "3px";
    colorLabel.addEventListener('click', (event) => 
        {
            if (isGameEditorDisabled())
            {
                enableGameEditor();
                return;
            }
            const thisGame = findGameForActiveTab();
            const label = event.target;
            const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
            const maxColors = playerCount;
            const nextColor = (window.cacheColor + 1) < maxColors ? window.cacheColor + 1 : 0;
            window.cacheColor = nextColor;
            const fontColor = GamesByEmail.Viktory2Game.resourcePack.teamFontColors[nextColor];
            label.style.color = fontColor;
            const colorText = window.KomputerNations.isActive ? getSelectedDescription(nextColor) : GamesByEmail.Viktory2Game.resourcePack.teamTitles[nextColor];
            label.innerText = colorText;
        });
    colorLabel.addEventListener('mouseenter', (event) =>
        {
            if (isGameEditorDisabled())
            {
                return;
            }
            const label = event.target;
            label.style.fontWeight = "bold";
        });
    colorLabel.addEventListener('mouseleave', (event) =>
        {
            const label = event.target;
            label.style.fontWeight = "normal";
        });
    container.appendChild(colorLabel);
}


function addUnitLabel(container, radioButton, value)
{
    if (value !== "Unit")
    {
        return;
    }
    window.editorUnitTypes = ["Infantry", "Cavalry", "Artillery", "Frigate", "Clear"];
    window.editorTypeIndex = 0;
    window.editorUnitType = window.editorUnitTypes[window.editorTypeIndex];
    const unitLabel = document.createElement('label');
    makeNonSelectable(unitLabel);
    const unitText = window.editorUnitTypes[window.editorTypeIndex];
    unitLabel.innerText = unitText;
    unitLabel.id = "unitLabel";
    unitLabel.htmlFor = "RadioGroup_GameEditor_Unit";
    const fontColor = "thistle"; 
    unitLabel.style.color = fontColor;
    unitLabel.style.fontSize = "12px";
    unitLabel.style.fontFamily = "Verdana";
    unitLabel.style.textDecoration = "underline";
    unitLabel.style.marginLeft = "3px";
    unitLabel.addEventListener('click', (event) => 
        {
            if (isGameEditorDisabled())
            {
                enableGameEditor();
                return;
            }
            const label = event.target;
            const maxIndex = window.editorUnitTypes.length;
            window.editorTypeIndex = (window.editorTypeIndex + 1) < maxIndex ? window.editorTypeIndex + 1 : 0;
            window.editorUnitType = window.editorUnitTypes[window.editorTypeIndex]
            label.innerText = window.editorUnitType;
            label.style.color = '';
            let radioButton = document.getElementById("RadioGroup_GameEditor_Unit");
            radioButton.checked = true;
            window.isEditorInputSelected[radioButton.value] = true;
        });
    unitLabel.addEventListener('mouseenter', (event) =>
        {
            if (isGameEditorDisabled())
            {
                return;
            }
            const label = event.target;
            label.style.fontWeight = "bold";
        });
    unitLabel.addEventListener('mouseleave', (event) =>
        {
            const label = event.target;
            label.style.fontWeight = "normal";
        });
    container.appendChild(unitLabel);
}


function resetDefaultColor(thisGame)
{
    const colorLabel = document.getElementById("colorLabel");
    const defaultColor = thisGame.perspectiveColor;
    const fontColor = GamesByEmail.Viktory2Game.resourcePack.teamFontColors[defaultColor];
    colorLabel.style.color = fontColor;
    const colorText = GamesByEmail.Viktory2Game.resourcePack.teamTitles[defaultColor];
    colorLabel.innerText = colorText;
    window.cacheColor = defaultColor;
    const unitLabel = document.getElementById("unitLabel");
    unitLabel.style.color = '';
}


function dimDefaultColor()
{
    const label = document.getElementById("colorLabel");
    const fontColor = "thistle";
    label.style.color = fontColor;
    const unitLabel = document.getElementById("unitLabel");
    unitLabel.style.color = 'thistle';
}


function editorInputListener(radioButton)
{
    radioButton.addEventListener('click', () => 
        {
            Object.keys(window.isEditorInputSelected).forEach(key => { window.isEditorInputSelected[key] = false; });
            window.isEditorInputSelected[radioButton.value] = true;
            radioButton.checked = window.isEditorInputSelected[radioButton.value] ? true : false; 
            komputerLog("Pressed: " + radioButton.value);
            enableGameEditor();
        });
}


function getGameEditorTop()
{
    const playerNotesOffset = 14;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset );
}


function getGameEditorLeft()
{
    const playerNotesOffset = 200;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.32;
    return (window.scrollX + playerNotesMidwayX + playerNotesOffset );
}


function addGameEditorToggle(editorDiv)
{
    let toggle = document.createElement("input");
    toggle.setAttribute("type", "checkbox");
    toggle.id = "GameEditorToggle";
    toggle.addEventListener('click', gameEditorToggleClick);
	let style = {position: 'relative', top: -18, left: 24, 'z-index': '9999', marginBottom: -8}; 
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    editorDiv.appendChild(toggle);
}


function getNationsDivTop()
{
    const playerNotesOffset = 14;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset );
}


function getNationsDivLeft()
{
    const playerNotesOffset = 316;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.32;
    return (window.scrollX + playerNotesMidwayX + playerNotesOffset );
}


function gameEditorToggleClick(event, toggle)
{
    const thisGame = findGameForActiveTab(); 
    toggle = event ? event.currentTarget : toggle;
    if (toggle.checked)
    {
        stopAndReset();
        if (thisGame.playOptions.mapCustomizationData.length > 0)
        {
            thisGame.customizeMapDoAll(true);
        }
        resetDefaultColor(thisGame);
        window.cacheBoard = createCacheBoardValues(thisGame);
        window.cacheVisibility = createCacheVisibility(thisGame);
        window.nextVisibility = getNextVisibility();
        window.resetUnits = getResetUnits(thisGame);
        window.cacheMovePhase = thisGame.movePhase;
        thisGame.movePhase = -1;
        thisGame.update();
        document.addEventListener('mousedown', gameEditorMouseDown);
        document.addEventListener('mousemove', gameEditorMouseMove);
        document.addEventListener('mouseup', gameEditorMouseUp);
        komputerLog("Game Editor: On");
        thisGame.maybeHideOverlay();
        maybeSelectDefaultEditorInput();
        setTimeout(function(){ styleGameEditor(thisGame) }, 10);
    }
    else
    {
        thisGame.movePhase = window.cacheMovePhase < 0 ? 0 : window.cacheMovePhase;
        const content = getDocumentContent();
        content.style.backgroundColor = window.cacheContentBackgroundColor;
        content.style.cursor = "auto";
        const title = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameState");  
        title.style.backgroundColor = "";
        dimDefaultColor();
        document.removeEventListener('mousedown', gameEditorMouseDown);
        document.removeEventListener('mousemove', gameEditorMouseMove);
        document.removeEventListener('mouseup', gameEditorMouseUp);
        komputerLog("Game Editor: Off");
        thisGame.update();
        removeExcessUnits(thisGame);
    }
    setTimeout(function ()
    {
        resetButtonPositions();
        updateKomputerOptions();
    }, 100);
}


function styleGameEditor(thisGame)
{
    const title = document.getElementById("Foundation_Elemental_" + GameVersion + "_gameState");            
    title.innerText = "Game Editor";
    title.style.backgroundColor = "darkseagreen"
    const content = getDocumentContent();
    const editorBackgroundColor = "rgb(31, 124, 72)"; // "seagreen" - 15.
    if (content.style.backgroundColor !== editorBackgroundColor)
    {
        window.cacheContentBackgroundColor = content.style.backgroundColor;
        content.style.backgroundColor = editorBackgroundColor;
    } 
    content.style.cursor = "cell";
    for (const piece of thisGame.pieces)
    {
        if (thisGame.isTargetPoint(piece.boardPoint))
        {
            piece.setBorder(false);  
        }
    } 
    const prompt = document.getElementById("Foundation_Elemental_" + GameVersion + "_gamePrompts");
    prompt.innerText = "Game is paused. Customize any hex, then switch off the Game Editor to resume play.";
}


function removeExcessUnits(thisGame)
{
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    let colorCount = playerCount;
    for (let i = 0; i < colorCount; i++)
    {
        let tempCapital = null;
        if (!thisGame.pieces.findCapitalPiece(i))
        {
            tempCapital = getCenterPiece(thisGame).addUnit(i, "C");
        }
        thisGame.removeExcessPieces(i, true);
        if (tempCapital)
        {
            tempCapital.piece.removeUnit(tempCapital);
        }
    } 
}


function createCacheBoardValues(thisGame)
{
    let cacheBoard = [];
    for (const piece of thisGame.pieces)
    {
        cacheBoard.push(piece.boardValue);
    }
    return cacheBoard.join('');
}


function createCacheVisibility(thisGame)
{
    let cacheVis = [];
    for (const piece of thisGame.pieces)
    {
        cacheVis.push(piece.hidden);
    }
    return cacheVis;
}
    
    
function getNextVisibility(piece = null)
{
    if (piece === null)
    {
        const thisGame = findGameForActiveTab();
        let nextVisibility = [];
        for (const piece of thisGame.pieces)
        {
            nextVisibility.push(!piece.hidden);
        }
        return nextVisibility;
    }
    if (!window.firstSelectedIndex)
    {
        window.firstSelectedIndex = piece.index;
    }
    return window.nextVisibility[window.firstSelectedIndex];
}


function getEditorUnitType()
{
    switch (window.editorUnitType)
    {
        case "Infantry":
            return "i";
        case "Cavalry":
            return "c";
        case "Artillery":
            return "a";
        case "Frigate":
            return "f";
        case "Clear":
            return window.editorUnitType;
        default:
            console.log("Game Editor got unknown unit type: " + window.editorUnitType);
            return "i";
    }
}


function getEditorColor()
{
    return window.cacheColor;
}


function getResetValue(piece)
{
    return window.cacheBoard[piece.index];
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


function gameEditorMouseDown(event, draggingMouse = false)
{
    if (isGameEditorDisabled() || isGhostClick(draggingMouse))
    {
        return; 
    }
    maybeSelectDefaultEditorInput();
    window.isMouseDown = true;
    const xOffset = document.getElementById("Foundation_Elemental_" + GameVersion + "_pieces").getBoundingClientRect().left + window.scrollX; 
    const yOffset = document.getElementById("Foundation_Elemental_" + GameVersion + "_pieces").getBoundingClientRect().top + window.scrollY; 
    const screenPoint = new Foundation.Point(event.pageX - xOffset, event.pageY - yOffset); 
    const thisGame = findGameForActiveTab(); 
    const boardPoint = thisGame.boardPointFromScreenPoint(screenPoint);   
    const piece = thisGame.pieces.findAtPoint(boardPoint);
    const reserveIndex = thisGame.pieces.length - 1;
    const isValidHex = (piece && (piece.index !== reserveIndex));
    if (!isValidHex)
    {
        return;
    }
    const inputValues = {
        "Plains" : {type: "terrain", data: "p"},
        "Grass" : {type: "terrain", data: "g"},
        "Forest" : {type: "terrain", data: "f"},
        "Mountain" : {type: "terrain", data: "m"},
        "Water" : {type: "terrain", data: "w"},
        "Capital" : {type: "capital", data: null },
        "Settlement" : {type: "build", data: null },
        "Unit" : { type: "military", data: null },
        "Color" : {type: "color", data: null },
        "Visibility" : {type: "visibility", data: null },
        "Reset Changes" : {type: "reset", data: null }
    } 
    for (let key in window.isEditorInputSelected)
    {
        if (!window.isEditorInputSelected[key])
        {
            continue;
        }
        if (draggingMouse && piece.index === window.lastEditIndex)
        {
            return;
        }
        let output = inputValues[key];
        if (output.type === "terrain")
        {
            if (piece.isPerimeter())
            {
                return;
            }
            drawTerrain(thisGame, piece, output.data);
        }
        else if (output.type === "capital")
        {
            if (piece.isPerimeter())
            {
                return;
            }
            drawCapital(thisGame, piece);
        }
        else if (output.type === "build")
        {
            if (piece.isPerimeter())
            {
                return;
            }
            output.data = getNextBuild(piece);
            drawBuild(thisGame, piece, output.data);
        }
        else if (output.type === "military")
        {
            output.data = getEditorUnitType();
            if (piece.isPerimeter() && output.data !== 'f')
            {
                return;
            }
            drawMilitary(thisGame, piece, output.data, draggingMouse);
        }
        else if (output.type === "color")
        {
            output.data = getEditorColor();
            drawColor(thisGame, piece, output.data);
        }
        else if (output.type === "visibility")
        {
            output.data = getNextVisibility(piece);
            drawVisibility(thisGame, piece, output.data);
        }
        else if (output.type === "reset")
        {
            output.data = getResetValue(piece);
            drawReset(thisGame, piece, output.data);
        }
        window.lastEditIndex = piece.index;
        window.lastClickTime = Date.now();
        return;
    }
}


function isGhostClick(draggingMouse)
{
    if (draggingMouse || !window.lastClickTime)
    {
        return false;
    }
    const timeElapsed = Date.now() - window.lastClickTime;
    return timeElapsed < 100 ? true : false;
}


function getNextBuild(piece)
{
    const anyColor = -1;
    if (piece.hasTown(anyColor))
    {
        return 2;
    }
    if (piece.hasCity(anyColor))
    {
        return 0;
    }
    return 1;
}


function getResetUnits(thisGame)
{
    let allResetUnits = [];
    let pieceUnits = [];
    for (const piece of thisGame.pieces)
    {
        for (const unit of piece.units)
        {
            pieceUnits.push(unit);
        }
        allResetUnits.push(pieceUnits);
        pieceUnits = [];
    }
    return allResetUnits;
}


function drawTerrain(thisGame, piece, output)
{
    const anyColor = -1;
    if (piece.boardValue !== output)
    {
        const newLand = "l"
        piece.boardValue = newLand;
        piece.setValue(output, false);
        if (piece.hasCivilization(anyColor))
        {
            thisGame.update();
            styleGameEditor(thisGame);
            removeExcessUnits(thisGame);
        }
    }
    reveal(thisGame, piece);
    if (piece.isWater())
    {
        while (piece.hasInfantry(anyColor) || piece.hasCavalry(anyColor) || piece.hasArtillery(anyColor))
        {
            drawMilitary(thisGame, piece, "Clear", false);
        }
        if (piece.hasCivilization(anyColor))
        {
            const clear = 0;
            drawBuild(thisGame, piece, clear);
        }
        if (piece.hasCapital(anyColor))
        {
            drawCapital(thisGame, piece);
        }
    }
    if (piece.isLand())
    {
        while (piece.hasFrigate(anyColor))
        {
            drawMilitary(thisGame, piece, "Clear", false);
        }
    }
}


function drawCapital(thisGame, piece)
{
    const color = window.cacheColor;
    const oldCapitalPiece = thisGame.pieces.findCapitalPiece(color);
    if (oldCapitalPiece)
    {
        const oldCapitalUnit = oldCapitalPiece.findCapital(color);
        oldCapitalPiece.removeUnit(oldCapitalUnit);
        oldCapitalPiece.updateUnitDisplay();
        if (oldCapitalPiece.index === piece.index)
        {
            return;
        }
    }
    const anyColor = -1;
    if (piece.isWater())
    {
        while (piece.hasFrigate(anyColor))
        {
            drawMilitary(thisGame, piece, "Clear", false);
        }
        drawTerrain(thisGame, piece, "p");
    }
    let civ = piece.findCivilization(anyColor)
    if (civ)
    {
        civ.color = color;
    }
    else
    {
        const addTown = 1;
        drawBuild(thisGame, piece, addTown);
    }
    const blockingCapital = piece.findOpponentCapital(color);
    if (blockingCapital)
    {
        blockingCapital.color = color;
        blockingCapital.placedThisTurn = false;
    }
    else
    {
        let newCapital = piece.addUnit(color, "C");
        newCapital.placedThisTurn = false;
    }
    piece.updateUnitDisplay();
    thisGame.update();
    styleGameEditor(thisGame);
}


function reveal(thisGame, piece)
{
    if (piece.hidden)
    {
        piece.hidden = false;
        piece.setVisibility(piece.hidden); 
        const visible = 2;
        let boardVisArray = thisGame.boardVisibility.split("");
        boardVisArray[piece.index] = visible;
        thisGame.boardVisibility = boardVisArray.join("");
    }
}


function drawBuild(thisGame, piece, output)
{
    const anyColor = -1;
    const clear = 0;
    if (piece.isWater() && output !== clear)
    {
        while (piece.hasFrigate(anyColor))
        {
            drawMilitary(thisGame, piece, "Clear", false);
        }
        drawTerrain(thisGame, piece, "p");
    }
    const addTown = 1;
    const addCity = 2;
    let indeciesToReveal = null;
    if (output === addTown)
    {
        piece.addUnit(window.cacheColor, "t");
        indeciesToReveal = piece.getAdjacentIndecies(addTown);
        indeciesToReveal.push(piece.index);
        convertEnemies(piece, window.cacheColor);
    }
    else if (output === addCity)
    {
        const town = piece.findCivilization(anyColor);
        if (town)
        {
            piece.removeUnit(town);
            piece.addUnit(town.color, "y");
            indeciesToReveal = piece.getAdjacentIndecies(addCity);
            indeciesToReveal.push(piece.index);
            convertEnemies(piece, town.color);
        }
    }
    else if (output === clear)
    {
        const civ = piece.findCivilization(anyColor);
        if (civ)
        {
            piece.removeUnit(civ);
        }
    }            
    if (indeciesToReveal)
    {
        revealPieces(thisGame, indeciesToReveal);
    }
    piece.updateUnitDisplay();
    thisGame.update();
    styleGameEditor(thisGame);
}


function convertEnemies(piece, color)
{
    for (let unit of piece.units)
    {
        unit.color = color;
        if (window.KomputerNations.isActive)
        {
            unit.maskColor = getSelectedMask(color);
        }
    }
}


function revealPieces(thisGame, indeciesToReveal)
{
    let boardVisArray = thisGame.boardVisibility.split("");
    for (const index of indeciesToReveal)
    {
        const pieceToReveal = thisGame.pieces[index];
        if (pieceToReveal.hidden)
        {
            pieceToReveal.hidden = false;
            pieceToReveal.setVisibility(pieceToReveal.hidden); 
            const visible = 2;
            boardVisArray[pieceToReveal.index] = visible;
        }
    }
    thisGame.boardVisibility = boardVisArray.join("");
}


function drawVisibility(thisGame, piece, output)
{
    if (piece.hidden !== output)
    {
        piece.hidden = output;
        piece.setVisibility(piece.hidden); 
        const visible = piece.hidden ? 0 : 2;
        let boardVisArray = thisGame.boardVisibility.split("");
        boardVisArray[piece.index] = visible;
        thisGame.boardVisibility = boardVisArray.join("");
    }
}


function drawMilitary(thisGame, piece, type, draggingMouse)
{
    const anyColor = -1;
    if (type === "f" && !piece.isWater())
    {
        while (piece.hasInfantry(anyColor) || piece.hasCavalry(anyColor) || piece.hasArtillery(anyColor))
        {
            drawMilitary(thisGame, piece, "Clear", false);
        }
        drawTerrain(thisGame, piece, "w");
    }
    const drawingLandUnit = (type === "i") || (type === "c") || (type === "a");
    if (piece.isWater() && drawingLandUnit)
    {
        while (piece.hasFrigate(anyColor))
        {
            drawMilitary(thisGame, piece, "Clear", false);
        }
        drawTerrain(thisGame, piece, "p");
    }
    const color = window.cacheColor;
    const aboveBoardText = thisGame.getElement("aboveBoard");
    const hasWarning = aboveBoardText ? aboveBoardText.innerText.substr(0, 'Warning'.length) === 'Warning' : false;
    if (hasWarning)
    {
        if (removeExcessUnit(piece, color, type))
        {
            thisGame.setAboveBoardHtml('', 999);
            return;
        }
        forceRemoveUnit(thisGame, piece, color, type);
        removeExcessUnits(thisGame);
        thisGame.setAboveBoardHtml('', 999);
        return;
    } 
    if (type === "Clear")
    {
        let update = false;
        for (let unit of piece.units)
        {
            if (unit.isMilitary())
            {
                piece.removeUnit(unit, true);
                update = true;
            }
        }
        if (update)
        {
            piece.updateUnitDisplay();
            thisGame.update();
            styleGameEditor(thisGame);
        }
        return;
    }
    if (draggingMouse)
    {
        let lastPiece = thisGame.pieces[window.lastEditIndex];
        if (removeExcessUnit(lastPiece, color, type))
        {
            drawUnit(thisGame, piece, color, type);
        }
        else
        {
            removeExcessUnits(thisGame);
        }
        return;
    }
    const controlsCapital = true;
    const shouldSelect = false;
    let hasReserveUnit = getHasPlayableReserveUnit(thisGame, controlsCapital, shouldSelect, color, type);
    if (hasReserveUnit)
    {
        const reserves = thisGame.teams.findTeamByColor(color).reserveUnits;
        const typeIndex = reserves.indexOf(type);
        let reserveArray = reserves.split("");
        reserveArray.splice(typeIndex, 1);
        thisGame.player.team.reserveUnits = reserveArray.join("");
        drawUnit(thisGame, piece, color, type);
        thisGame.update();
        styleGameEditor(thisGame);
        return;
    }
    drawUnit(thisGame, piece, color, type);
    if (needsExtrasRemovedForAnyColor(thisGame))
    {
        thisGame.setAboveBoardHtml(getUnitWarning(), 999);
    }
}


function removeExcessUnit(piece, color, type)
{
    const excessUnit = piece.findUnit(color, type);
    if (excessUnit)
    {
        piece.removeUnit(excessUnit);
        piece.updateUnitDisplay();
        return true;
    }
    return false;
}


// Clone of codebase function that works on all player colors.
function needsExtrasRemovedForAnyColor(thisGame)
{
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    const colorCount = playerCount;
    for (let color = 0; color < colorCount; color++)
    {
        let unitCounts = thisGame.pieces.getUnitCounts(color);
        thisGame.extraUnits = new Array();
        thisGame.extraUnits["f"] = thisGame.getFrigateDifference(unitCounts);
        thisGame.extraUnits["a"] = thisGame.getArtilleryDifference(unitCounts);
        thisGame.extraUnits["c"] = thisGame.getCavalryDifference(unitCounts);
        thisGame.extraUnits["i"] = thisGame.getInfantryDifference(unitCounts);
        let needed=false;
        for (let i in thisGame.extraUnits)
        {
            if (thisGame.extraUnits[i] < 0)
            {
                thisGame.extraUnits[i] *= -1;
                needed=true;
            }
            else
            {
                thisGame.extraUnits[i] = 0;
            }
        }
        if (!needed)
        {
            thisGame.extraUnits=null;
            continue;
        }
        return needed;
    }
}


function drawUnit(thisGame, piece, color, type)
{
    convertEnemies(piece, color);
    let indeciesToReveal = piece.getAdjacentIndecies(1);
    indeciesToReveal.push(piece.index);
    revealPieces(thisGame, indeciesToReveal);
    const newUnit = piece.addUnit(color, type);
    newUnit.movementComplete = (thisGame.perspectiveColor === color) ? false: true; 
    piece.updateUnitDisplay();
    thisGame.update();
    styleGameEditor(thisGame);
}


function getUnitWarning()
{
    return "<h2 style='color:red'>Warning: Settlements too few. Click unit to recall.</h2>";
}


function forceRemoveUnit(thisGame, piece, color, type)
{
    // Try to remove unit near selected piece.
    let removed = false;
    const adjacentIndecies = piece.getAdjacentIndecies(2);
    for (const index of adjacentIndecies)
    {
        const adjacentPiece = thisGame.pieces[index];
        if (adjacentPiece.hidden)
        {
            continue;
        }
        removed = removeExcessUnit(adjacentPiece, color, type);
        if (removed)
        {
            return;
        }
    }
    // Remove any unit.
    for (const otherPiece of thisGame.pieces)
    {
        if (otherPiece.index === piece.index)
        {
            continue;
        }
        removed = removeExcessUnit(otherPiece, color, type);
        if (removed)
        {
            return;
        }
    } 
}


function drawColor(thisGame, piece, output)
{
    let update = false;
    for (let unit of piece.units)
    {
        if (unit.color !== output && !unit.isCapital())
        {
            unit.color = output;
            unit.maskColor = getSelectedMaskColor(unit);
            update = true;
        }
    }
    if (update)
    {
        piece.updateUnitDisplay();
        thisGame.update();
        styleGameEditor(thisGame);
        removeExcessUnits(thisGame);
    }
}


function drawReset(thisGame, piece, output)
{
    const outVis = window.cacheVisibility[piece.index];
    if ((output !== piece.boardValue) || (outVis !== piece.hidden))
    {
        const newLand = "l";
        piece.boardValue = newLand;
        piece.setValue(output, false);
        piece.hidden = outVis;
        piece.setVisibility(piece.hidden); 
        const visible = piece.hidden ? 0 : 2;
        let boardVisArray = thisGame.boardVisibility.split("");
        boardVisArray[piece.index] = visible;
        thisGame.boardVisibility = boardVisArray.join("");
    }
    piece.removeAllUnits(false);
    for (let unit of window.resetUnits[piece.index])
    {
        if (unit.isCapital())
        {
            const oldCapitalPiece = thisGame.pieces.findCapitalPiece(unit.color);
            if (oldCapitalPiece)
            {
                const oldCapitalUnit = oldCapitalPiece.findCapital(unit.color);
                oldCapitalPiece.removeUnit(oldCapitalUnit);
                oldCapitalPiece.updateUnitDisplay();
            }
        }
        piece.units.push(unit);
        unit.piece = piece;
    }
    thisGame.update();
    styleGameEditor(thisGame);
    removeExcessUnits(thisGame);    
    piece.updateUnitDisplay();
}


function maybeSelectDefaultEditorInput()
{
    for (const input in window.isEditorInputSelected)
    {
        if (window.isEditorInputSelected[input] === true)
        {
            return;
        }
    }        
    let radioButton = document.getElementById("RadioGroup_GameEditor_Plains");
    if (radioButton)
    {
        radioButton.checked = true;
        window.isEditorInputSelected.Plains = true;
    }
}


function gameEditorMouseMove(event)
{
    if (window.isMouseDown)
    {
        gameEditorMouseDown(event, true);
    }
}


function gameEditorMouseUp()
{
    window.isMouseDown = false;
    window.firstSelectedIndex = null;
    window.nextVisibility = getNextVisibility();
}


function disableGameEditor()
{
    const toggle = document.getElementById("GameEditorToggle");
    if (!toggle)
    {
        return;
    }
    if (toggle.checked)
    {
        toggle.checked = false;
        gameEditorToggleClick(null, toggle);
    }
}


function isGameEditorDisabled()
{
    const toggle = document.getElementById("GameEditorToggle");
    return (!toggle || !toggle.checked) ? true : false;
}


function enableGameEditor()
{
    if (!isOnPreviewTab())
    {
        return;
    }
    const toggle = document.getElementById("GameEditorToggle");
    if (toggle && !toggle.checked)
    {
        toggle.checked = true;
        gameEditorToggleClick(null, toggle);
    }
}


function hideGameEditor()
{
    let gameEditor = document.getElementById("GameEditor");
    if (gameEditor)
    {
        gameEditor.style.visibility = 'hidden';
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
        multiplayerForm.innerText = "All Maps";
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
    return (window.scrollY + playerNotesRect.bottom + playerNotesOffset );
}


function getMultiplayerFormLeft()
{
    const playerNotesOffset = 192 + 256;
    const playerNotesRect = document.getElementById('Foundation_Elemental_' + GameVersion + '_playerNotes').getBoundingClientRect();
    const playerNotesMidwayX = (playerNotesRect.left + playerNotesRect.right) * 0.32;
    return (window.scrollX + playerNotesMidwayX + playerNotesOffset );
}


function multiplayerRestartButtonMouseClick(thisGame)
{
    stopAndReset();
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
        setTimeout(function(){ 
            updateKomputerOptions();
            resetButtonPositions(); 
        }, 2000 );
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


/// Napoleonic Nations

function addNations(thisGame, enableMenu = false)
{
    if (!window.KomputerNations)
    {
        window.KomputerNations = {
            isActive: false,
            path: window.KomputerImagePath,
            Siamese: 9,
            Portuguese: 10,
            Ethiopian: 11,
            French: 12,
            Prussian: 13,
            Persian: 14,
            Dutch: 15,
            American: 16,
            British: 18,
            Ashanti: 19,
            Russian: 20,
            Qing: 21,
            Spanish: 22, 
            Mughal: 23,
            Austrian: 24,
            Ottoman: 25,
            menuOptions: [
                "Portuguese",
                "Spanish",
                "British",
                "French",
                "Dutch",
                "Prussian",
                "Austrian",
                "Russian",
                "Ottoman",
                "Persian",
                "Mughal",
                "Qing",
                "Siamese",
                "Ethiopian",
                "Ashanti",
                "American",
            ],
            menuPluralAddSuffix: 
            {
                Portuguese: false,
                Spanish: false,
                British: false,
                French: false,
                Dutch: false,
                Prussian: true,
                Austrian: true,
                Russian: true,
                Ottoman: true,
                Persian: true,
                Mughal: false,
                Qing: false,
                Siamese: false,
                Ethiopian: true,
                Ashanti: false,
                American: true
            } 
        }
    }
    let nationsDiv = document.getElementById("NationsDiv");
    if (!nationsDiv)
    {
        nationsDiv = document.createElement('div');
        nationsDiv.id = "NationsDiv";
        nationsDiv.style.display = 'flex';
        nationsDiv.style.flexDirection = 'column';
        nationsDiv.style.position = "absolute";
        nationsDiv.style.top = getNationsDivTop();
        nationsDiv.style.left = getNationsDivLeft();
        nationsDiv.style.fontSize = "10px";
        nationsDiv.style.fontFamily = "Verdana";
        nationsDiv.style.padding = '4px';
    }
    nationsDiv.innerText = "Historic Nations";
    makeNonSelectable(nationsDiv);
    addNationsToggle(nationsDiv);
    addNationsMenu(thisGame, nationsDiv);
    document.body.appendChild(nationsDiv);
    if (enableMenu)
    {
        enableNations();
    }
}


function addNationsToggle(nationsDiv)
{
    let toggle = document.createElement("input");
    toggle.setAttribute("type", "checkbox");
    toggle.id = "NationsToggle";
    toggle.addEventListener('click', function(event){ nationsToggleClick(event) });
	let style = {position: 'relative', top: -18, left: 48, 'z-index': '9999', marginBottom: -8}; 
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    nationsDiv.appendChild(toggle);
}


function enableNations()
{
    let nationsToggle = document.getElementById("NationsToggle");
    if (nationsToggle)
    {
        nationsToggle.checked = true;
        nationsToggleClick({srcElement: nationsToggle});
    }
}


function hideNationsDiv()
{
    let nationsDiv = document.getElementById("NationsDiv");
    if (nationsDiv)
    {
        nationsDiv.style.visibility = 'hidden';
    }
}


function disableNations()
{
    let nationsToggle = document.getElementById("NationsToggle");
    if (nationsToggle)
    {
        nationsToggle.checked = false;
        nationsToggleClick({srcElement: nationsToggle});
    }
}


function nationsToggleClick(event)
{
    let thisGame = findGameForActiveTab();
    window.KomputerNations.isActive = event.srcElement.checked;
    if (window.KomputerNations.isActive)
    {
        updateNationsMenu(thisGame);
    }
    thisGame.pieces.updateUnitDisplays();
    thisGame.updateTeamTitles();
    updateKomputerOptions();
    resetButtonPositions();
    komputerLog("NationsToggle: " + event.srcElement.checked);  
}


function renameTeams(thisGame, useNations)
{
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    for (let playerColor = 0; playerColor < playerCount; playerColor++)
    {
        const player = thisGame.teams[playerColor].players[0];
        if (useNations)
        {
            player.titleStash = player.title
            player.title = getTeamNoun(getSelectedDescription(playerColor));
        }
        else
        {   
            const previewTitle = "Player " + (playerColor + 1);
            const customTitle = player.titleStash ? player.titleStash : player.title;
            const nextTitle = thisGame.previewing ?  previewTitle: customTitle;
            player.title = nextTitle;
        }
    } 
}


function getSelectedDescription(color) 
{
    const nationSelector = document.getElementById("NationSelector_" + color);
    if (!nationSelector)
    {
        return null;
    }
    const menuOptions = window.KomputerNations.menuOptions;
    return menuOptions[nationSelector.selectedIndex];
}


function getTeamNoun(adjective)
{
    switch(adjective)
    {
        case "Portuguese": 
        {
            return "Portugal"
        }
        case "Spanish": 
        {
            return "Spain"
        }
        case "British": 
        {
            return "Britain"
        }
        case "French": 
        {
            return "France"
        }
        case "Dutch": 
        {
            return "The Netherlands"
        }
        case "Prussian": 
        {
            return "Prussia"
        }
        case "Austrian": 
        {
            return "Austria"
        }
        case "Russian": 
        {
            return "Russia"
        }
        case "Ottoman": 
        {
            return "Ottoman"
        }
        case "Persian": 
        {
            return "Persia"
        }
        case "Mughal": 
        {
            return "Mughal"
        }
        case "Qing": 
        {
            return "Qing"
        }
        case "Siamese": 
        {        
            return "Siam"
        }
        case "Ethiopian": 
        {
            return "Ethiopia"
        }
        case "Ashanti": 
        {
            return "Ashanti"
        }
        case "American": 
        {
            return "USA"
        }
    }
}


function addNationsMenu(thisGame, parent)
{
    const nations = window.KomputerNations.menuOptions;
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    const maxNationCount = playerCount;
    for (let color = 0; color < maxNationCount; color++)
    {
        let colorLabel = document.createElement("label");
        makeNonSelectable(colorLabel);
        colorLabel.style.fontFamily = "Verdana";
        colorLabel.style.fontSize = "10px";
        colorLabel.style.margin = "2px";
        colorLabel.innerText = GamesByEmail.Viktory2Game.resourcePack.teamTitles[color];  
        parent.append(colorLabel);
        let nationSelector = document.createElement("select");
        for (const nation of nations)
        {
            let option = document.createElement("option");  
            option.value = color;
            option.innerText = nation;
            setDefaultNation(option, color, nation);
            nationSelector.appendChild(option);
        }
        nationSelector.style.fontFamily = "Verdana";
        nationSelector.style.fontSize = "10px";
        nationSelector.style.margin = "1px";
        nationSelector.id = "NationSelector_" + color;
        nationSelector.addEventListener('change', function(event){ pickNation(thisGame, event, nations) });
        parent.append(nationSelector);
    }
}


function updateNationsMenu(thisGame)
{
    let selectorCount = 0;
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    const targetSelectorCount = playerCount;
    const maxCount = GamesByEmail.Viktory2Game.resourcePack.teamTitles.length;
    for (let i = 0; i < maxCount; i++)
    {
        if (document.getElementById("NationSelector_" + i))
        {
            selectorCount++;
            continue;
        }
        break;
    }
    if (selectorCount === targetSelectorCount)
    {
        return;
    }
    let nationsDiv = document.getElementById("NationsDiv");
    while (nationsDiv.firstChild) 
    {
        nationsDiv.removeChild(nationsDiv.firstChild);
    }
    const enableMenu = true;
    addNations(thisGame, enableMenu);
}


function pickNation(thisGame, event, nations)
{
    const originColor = event.target.value * 1;
    const maskColor = window.KomputerNations[nations[event.target.selectedIndex]];
    for (let piece of thisGame.pieces)
    {
        for (let unit of piece.units)
        {
            if (unit.color === originColor)
            {
                unit.maskColor = maskColor;
            }
        }
        piece.updateUnitDisplay();
    }
    thisGame.updateTeamTitles();
    komputerLog("Clicked selector # " + event.target.value);
    komputerLog("Selected: " + nations[event.target.selectedIndex]);
}


function getSelectedMask(color)
{
    if (!window.KomputerNations.isActive)
    {
        return color;
    }
    const nationSelector = document.getElementById("NationSelector_" + color);
    const menuOptions = window.KomputerNations.menuOptions;
    return window.KomputerNations[menuOptions[nationSelector.selectedIndex]];    
}


function getSelectedMaskColor(unit)
{
    if (!window.KomputerNations.isActive)
    {
        return unit.color;
    }
    const nationSelector = document.getElementById("NationSelector_" + unit.color);
    const menuOptions = window.KomputerNations.menuOptions;
    return window.KomputerNations[menuOptions[nationSelector.selectedIndex]];
}


function setDefaultNation(option, color, nation)
{
    if (
        (color === 0 && nation === "British") ||
        (color === 1 && nation === "Austrian") ||
        (color === 2 && nation === "Mughal") ||
        (color === 3 && nation === "French") ||
        (color === 4 && nation === "Russian") ||
        (color === 5 && nation === "Ottoman") ||
        (color === 6 && nation === "Spanish") ||
        (color === 7 && nation === "Qing")
    )
    {
        option.selected = true;
    }
}


function swapColorForMask(unit)
{
    if (!window.KomputerNations.isActive)
    {
        return;
    }
    if (unit.maskColor === "undefined")
    {
        unit.maskColor = getSelectedMaskColor(unit);
    }
    if (unit.maskColor !== unit.color)
    {
        unit.colorStash = unit.color;
        unit.color = unit.maskColor;
    }
}


function revertColorFromMask(unit)
{
    if (!window.KomputerNations.isActive)
    {
        return;
    }
    if (unit.colorStash !== unit.color)
    {
        unit.color = unit.colorStash;
    }
}


function nationHasElephants(maskColor)
{
    return (maskColor === window.KomputerNations.Siamese) || (maskColor === window.KomputerNations.Mughal);
}


/// Napoleonic Sound Effects 


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
	let style = {position: 'absolute', top: getSoundToggleTop(), left:'126px', 'z-index': '9999'};
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    document.body.appendChild(toggle);
    // Toggle Label
    let toggleLabel = document.createElement("label");
    makeNonSelectable(toggleLabel);
    toggleLabel.id = "SoundToggleLabel_" + GameVersion;
    toggleLabel.htmlFor = "SoundToggle_" + GameVersion
    toggleLabel.innerText = "Sound";  
    style = {position: 'absolute', top: getSoundToggleLabelTop(), left:'145px', 'z-index': '9999', 'font-size': '8px'};
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
        let eventTypes = ["ambient", "battleArtillery", "battleCavalry", "battleCiv", "battleElephant", "battlePending", "battleRoll", "battleRollShort", "bombard_f", "bombard_a", "buildCiv", "customizeMap", "move_i", "move_c", "move_e", "move_a", "move_f", "place_i", "place_c", "place_e",  "place_a", "place_f", "lose", "win", "newGame"];
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
        case "battleElephant" : 
        {
            return getBattleElephantAudio();
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
        case "place_e" :
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
        case "move_e" :
        {
            return getMoveElephantAudio();
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


function getBattleElephantAudio()
{
    const numAudio = 2;
    const prefix = "battleElephant";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".wav"))
    }
    return audioHandles; 
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


function getMoveElephantAudio()
{
    const numAudio = 2;
    const prefix = "stomp";
    let audioHandles = [];
    for (let trackNumber = 1; trackNumber <= numAudio; trackNumber++)
    {
        audioHandles.push(new Audio(KomputerSound.path + prefix + trackNumber + ".ogg"))
    }
    return audioHandles;
}


function playCavalryBattle(piece)
{
    let hasElephant = false;
    const cavalry = findAllCavalry(piece);
    for (const unit of cavalry)
    {
        if (unit.maskColor && nationHasElephants(unit.maskColor))
        {
            hasElephant = true;
            break;
        }
    }
    if (hasElephant)
    {
        playSound("battleElephant");
    }
    else
    {
        playSound("battleCavalry");
    }
}


function playMoveSound(unit)
{
    if (!unit.isCavalry())
    {
        playSound("move_" + unit.type);
        return;
    }
    let isElephant = false;
    if (window.KomputerNations.isActive)
    {
        if (unit.maskColor && nationHasElephants(unit.maskColor))
        {
            isElephant = true;
        }
    }
    if (isElephant)
    {
        playSound("move_e");
    }
    else
    {
        playSound("move_c");
    }
}


function getMovingUnitType(unit)
{
    if (!unit.isCavalry())
    {
        return unit.type;
    }
    let isElephant = false;
    if (window.KomputerNations.isActive)
    {
        if (unit.maskColor && nationHasElephants(unit.maskColor))
        {
            isElephant = true;
        }
    }
    if (isElephant)
    {
        return "e";
    }
    else
    {
        return "c";
    }
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
                const isPlaying = (handle.currentTime > 0) && (handle.currentTime < handle.duration) && (handle.readyState > HTMLMediaElement.HAVE_CURRENT_DATA);
                if (isPlaying && !handle.paused)
                {
                    handle.pause();
                    komputerLog("Sound paused.");
                }
            }
        }
    }
}


// Turbo Toggle

function addTurboToggle()
{
    let toggle = document.createElement("input");
    toggle.setAttribute("type", "checkbox");
    toggle.id = "TurboToggle_" + GameVersion;
	let style = { position: 'absolute', top: getTurboButtonTop(), left: '126px', 'z-index': '9999' };  
	let toggleStyle = toggle.style;
	Object.keys(style).forEach(key => toggleStyle[key] = style[key]);
    toggle.addEventListener('click', function()
    {
        window.KomputerTurbo = this.checked;
        resetButtonPositions();
        komputerLog("Turbo Toggle: " + this.checked); 
    });  
    document.body.appendChild(toggle);
    document.body.appendChild(createTurboLabel(toggle));
    document.body.appendChild(createTurboInfo(toggle));
    addPopupListeners(toggle);
}


function createTurboLabel(toggle)
{
    let toggleLabel = document.createElement("label");
    makeNonSelectable(toggleLabel);
    toggleLabel.htmlFor = toggle.id;
    toggleLabel.id = "TurboToggleLabel_" + GameVersion;
    toggleLabel.innerText = "Turbo";  
    let style = { position: 'absolute', top: getTurboButtonLabelTop(), left:'145px', 'z-index': '9999', 'font-size': '8px' };
    Object.keys(style).forEach(key => toggleLabel.style[key] = style[key]);
    return toggleLabel;
}


function createTurboInfo(toggle)
{
    let toggleInfo = document.createElement("label");
    makeNonSelectable(toggleInfo);
    toggleInfo.htmlFor = toggle.id;
    toggleInfo.id = "TurboInfo_" + GameVersion;
    toggleInfo.innerText = "2x speed & skip some transit moves.";
    let style = { position: 'absolute', top: getTurboInfoTop(), left: '145px', fontSize: 8, zIndex: 9999, 
        visibility: 'hidden', backgroundColor: 'darkgreen', color: '#e3e3e3', borderRadius: '6px', padding: '4px'
    }
    Object.keys(style).forEach(key => toggleInfo.style[key] = style[key]);
    return toggleInfo;
}


function addPopupListeners(toggle)
{
    toggle.addEventListener('mouseover', function (event)
    {
        const popupInfo = event.target.labels[1];
        if (popupInfo)
        {
            popupInfo.style.visibility = '';
            if (!window.clearingPopup)
            {
                window.clearingPopup = true;
                setTimeout(function (){ 
                    popupInfo.style.visibility = 'hidden';
                    window.clearingPopup = false; 
                }, 3600);
            }
        }
    });
    toggle.addEventListener('mouseout', function (event)
    {
        const popupInfo = event.target.labels[1];
        if (popupInfo)
        {
            popupInfo.style.visibility = 'hidden';
        }
    });
    const toggleLabel = toggle.labels[0];
    toggleLabel.addEventListener('mouseover', function (event)
    {
        const popupInfo = event.target.control.labels[1];
        if (popupInfo)
        {
            popupInfo.style.visibility = '';
            if (!window.clearingPopup)
            {
                window.clearingPopup = true;
                setTimeout(function (){ 
                    popupInfo.style.visibility = 'hidden';
                    window.clearingPopup = false; 
                }, 3600);
            }
        } 
    });
    toggleLabel.addEventListener('mouseout', function (event)
    {
        const popupInfo = event.target.control.labels[1];
        if (popupInfo)
        {
            popupInfo.style.visibility = 'hidden';
        }
    });
}


function getTurbo(time)
{
    if (window.KomputerTurbo)
    {
        return time < 1000 ? time * 0.75 : time * 0.5;
    }
    return time;
}


// Komputer Options


function addKomputerOptions(thisGame)
{
    if (document.getElementById("KomputerOptions"))
    {
        return;
    }
    let optionsDiv = document.createElement("div");
    optionsDiv.id = "KomputerOptions";
    optionsDiv.style.position = "absolute";
    optionsDiv.style.top = getKomputerOptionsTop();
    optionsDiv.style.left = "172px";
    optionsDiv.style.display = "grid";
    document.body.appendChild(optionsDiv);
    let optionsLabel = createOptionsLabel(optionsDiv);
    optionsDiv.appendChild(optionsLabel);
    optionsDiv.appendChild(createOptionsMenu(thisGame));
    selectDefaultKomputerOption();
    addClickAwayListener();
}


function createOptionsLabel(optionsDiv)
{
    let optionsLabel = document.createElement("label");
    makeNonSelectable(optionsLabel);
    optionsLabel.innerText = "Options";
    optionsLabel.htmlFor = optionsDiv.id;
    let style = { zIndex: '9999', fontSize: '8px', fontFamily: "Verdana", textDecoration: 'underline', width: 'fit-content'};
    Object.keys(style).forEach(key => optionsLabel.style[key] = style[key]);
    optionsLabel.addEventListener('mouseenter', (event) =>
        {
            event.target.style.fontWeight = "bold";
        });
    optionsLabel.addEventListener('mouseleave', (event) =>
        {
            event.target.style.fontWeight = "normal";
        });
    optionsLabel.addEventListener('click', function(event)
        {
            const optionsMenu = event.target.nextElementSibling;
            const nextDisplay = (optionsMenu.style.display === "none") ? "inline-block" : "none";
            optionsMenu.style.display = nextDisplay;
            optionsMenu.style.top = "";
            const maxWindowY =  window.innerHeight;
            const maxMenuY = optionsMenu.getBoundingClientRect().bottom;
            if (maxWindowY < maxMenuY)
            {
                optionsMenu.style.top = optionsMenu.style.top - 106;
            }
            const nextVisibility = (optionsMenu.style.visibility === "hidden") ? "" : "hidden";
            optionsMenu.style.visibility = nextVisibility;
            updateKomputerOptions();
        });
    return optionsLabel;
}


function createOptionsMenu(thisGame)
{
    let optionsMenu = document.createElement("div");
    optionsMenu.id = "KomputerOptionsMenu";
    optionsMenu.innerText = "Komputer may...";
    let style = { display: "none", visibility: "hidden", position: "relative", zIndex: 9999, fontSize: '10px', fontFamily: "Verdana", 
        backgroundColor: "lightgrey", border: "thick solid darkgrey", marginTop: "1px", padding: "4px", paddingRight: "12px" };
    Object.keys(style).forEach(key => optionsMenu.style[key] = style[key]);
    optionsMenu.addEventListener('mouseleave', (event) =>
        {
            event.target.style.visibility = "hidden";
            event.target.style.display = "none";
        });
    window.KomputerPlayOptions = {};
    const inputOptions = [
        {value: "Play One Turn"},
        {value: "Play Selected"}    
    ];
    inputOptions.forEach(option => {
        window.KomputerPlayOptions[option.value] = false;
        const radioButton = createRadioButton(option.value, addKomputerPlayOptionListener, "RadioGroup_KomputerOptionsMenu_");
        radioButton.style.margin = "2px";
        radioButton.style.marginTop = "6px";
        if (option.value === "Play Selected")
        {
            radioButton.style.marginTop = "-20px";
            addKomputerOptionInputs(radioButton, thisGame);
        }
        optionsMenu.appendChild(radioButton);
    });
    return optionsMenu;
}


function addKomputerPlayOptionListener(radioButton)
{
    radioButton.addEventListener('change', () => 
        {
            Object.keys(window.KomputerPlayOptions).forEach(key => { window.KomputerPlayOptions[key] = false; });
            window.KomputerPlayOptions[radioButton.value] = true;
            radioButton.checked = window.KomputerPlayOptions[radioButton.value] ? true : false; 
            komputerLog("Pressed: " + radioButton.value);  
            if (radioButton.value === "Play One Turn")
            {
                selectAllInputOptions(false);
            }
            else
            {
                selectAllInputOptions();
            }
        }
    )
}


function updateKomputerOptions()
{   
    let optionCount = 0;
    for (let i = 0; document.getElementById("KomputerOptionInput_" + i); i++)
    {
        optionCount++;
    }
    let thisGame = findGameForActiveTab();
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    if (playerCount !== optionCount)
    {
        let optionsMenu = document.getElementById("KomputerOptionsMenu");
        let parent = optionsMenu.parentElement;
        optionsMenu.remove();
        parent.appendChild(createOptionsMenu(thisGame));
    }
    if (window.KomputerNations.isActive)
    {
        for (let i = 0; document.getElementById("KomputerOptionInput_" + i); i++)
        {
            let label = document.getElementById("KomputerOptionInput_" + i).labels[0];
            const nationSelectorForLabel = document.getElementById("NationSelector_" + i);
            const nationSelectorColor = nationSelectorForLabel.value;
            label.innerText = getSelectedDescription(nationSelectorColor);
        }
    }
    else
    {
        for (let i = 0; document.getElementById("KomputerOptionInput_" + i); i++)
        {
            let label = document.getElementById("KomputerOptionInput_" + i).labels[0];
            label.innerText = GamesByEmail.Viktory2Game.resourcePack.teamTitles[i];
        }
    }
    selectDefaultKomputerOption();
}


function addKomputerOptionInputs(parent, thisGame)
{
    const playerCount = (thisGame.numberOfDistinctPlayers > 0) ? thisGame.numberOfDistinctPlayers : thisGame.teams.length;
    let colorCount = playerCount;
    for (let color = 0; color < colorCount; color++)
    {
        let input = document.createElement("input");
        input.type = "checkbox";
        input.id = "KomputerOptionInput_" + color;
        input.style.marginTop = "44px";
        if (color === 0)
        {
            input.style.marginLeft = "-32px";
        }
        input.addEventListener("click", function()
        {
            document.getElementById("RadioGroup_KomputerOptionsMenu_Play One Turn").checked = false;
            window.KomputerPlayOptions["Play One Turn"] = false;
            document.getElementById("RadioGroup_KomputerOptionsMenu_Play Selected").checked = true;
            window.KomputerPlayOptions["Play Selected"] = true;
        });
        let label = document.createElement("label");
        makeNonSelectable(label);
        label.innerText = window.KomputerNations.isActive ? getSelectedDescription(color) : GamesByEmail.Viktory2Game.resourcePack.teamTitles[color];
        label.htmlFor = input.id;
        let style = { fontSize: '10px', fontFamily: "Verdana", marginRight: "4px", marginTop: "42px"};
        Object.keys(style).forEach(key => label.style[key] = style[key]);
        parent.appendChild(input);
        parent.appendChild(label);
    }
}


function addClickAwayListener()
{
    let content = document.getElementById("Foundation_Elemental_1_content");
    if (!content)
    {
        content = document.getElementById("Foundation_Elemental_2_gameContainer");
    }
    if (content)
    {
        content.addEventListener("click", function()
        {
            hideOptionsMenu();
        });
    }
}


function hideOptionsMenu()
{
    let optionsMenu = document.getElementById("KomputerOptionsMenu");
    optionsMenu.style.visibility = "hidden";
    optionsMenu.style.display = "none";
}


function playingNextTurn(thisGame)
{
    const color = thisGame.player.team.color;
    const newTurn = true;
    if (thisGame.player.isMyTurn() && isKomputerPlayApproved(color, newTurn))
    {
        window.isKomputerReady = true;
        runKomputerClick(thisGame);
        return true;
    }
    return false;
}


function isKomputerPlayApproved(color, newTurn)
{
    let playOneInput = document.getElementById("RadioGroup_KomputerOptionsMenu_Play One Turn"); 
    let colorInput = document.getElementById("KomputerOptionInput_" + color);
    if (playOneInput && colorInput)
    {
        return (colorInput.checked || (playOneInput.checked && !newTurn));
    }
    return false;
}


function getKomputerOptionsTop()
{
    return getTurboButtonLabelTop();
}


function selectDefaultKomputerOption()
{
    for (const option in window.KomputerPlayOptions)
    {
        if (window.KomputerPlayOptions[option] === true)
        {
            let radioButton = document.getElementById("RadioGroup_KomputerOptionsMenu_" + option);
            radioButton.checked = true;
            return;
        }
    }        
    let defaultOption = "Play One Turn";
    let radioButton = document.getElementById("RadioGroup_KomputerOptionsMenu_" + defaultOption);
    if (radioButton)
    {
        radioButton.checked = true;
        window.KomputerPlayOptions[defaultOption] = true;
        selectAllInputOptions(false);
    }
}


function selectAllInputOptions(turnOn = true)
{
    for (let i = 0; document.getElementById("KomputerOptionInput_" + i); i++)
    {
        let input = document.getElementById("KomputerOptionInput_" + i);
        input.checked = turnOn;
    }
}


function makeNonSelectable(element)
{
    if (!element || !element.style)
    {
        return;
    }
    const none = "none";
    const styleAttributes = {
        "-webkit-touch-callout": none, /* iOS Safari */
          "-webkit-user-select": none, /* Safari */
           "-khtml-user-select": none, /* Konqueror HTML */
             "-moz-user-select": none, /* Old Firefox */
              "-ms-user-select": none, /* Internet Explorer */
                  "user-select": none /* Non-prefixed, for 80% of browsers */
    }
    Object.keys(styleAttributes).forEach(key => element.style[key] = styleAttributes[key]);
}
