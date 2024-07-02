// ==UserScript==
// @name         Viktory Script
// @namespace    http://tampermonkey.net/
// @version      2024-05-05
// @description  Komputer - an AI for Viktory II
// @author       Wilbo Baggins / Stephen Montague
// @match        http://gamesbyemail.com/Games/Viktory2
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gamesbyemail.com
// ==/UserScript==


(function() {
    // Begin main script.
    console.log("Hello Viktory.");

    // Wait for page load.
    waitForKeyElements("#Foundation_Elemental_7_savePlayerNotes", () => {

        // Alias the game.
        let thisGame = Foundation.$registry[7];

        // Add button to page.
        console.log("Adding AI agent control button.");
        addButton("Run Komputer", runKomputerClick, thisGame);
        unsafeWindow.unlockKomputer = false;

        // Add global error handling.
        window.onerror = function(message, url, line, col, error) {
            console.warn(`Caught error. Will reset controls.`);
            clearIntervalsAndTimers();
            resetGlobals(true);
        };

        // Ready
        window.IS_KOMPUTER_READY = true;
   }); // End wait for page load

})(); // End main.


function runKomputerClick(thisGame)
{
    if (window.IS_KOMPUTER_READY)
    {
        resetGlobals();
        styleButtonForRun();
        runKomputer(thisGame);
    }
}


function clearIntervalsAndTimers()
{
  for (var i = setTimeout(function() {}, 0); i > 0; i--) {
    window.clearInterval(i);
    window.clearTimeout(i);
  }
}


function resetGlobals(resetButton = false)
{
    window.IS_KOMPUTER_READY = false;
    window.currentPlayerTurn = Foundation.$registry[7].perspectiveColor;
    window.moveIntervalId = null;
    window.movingUnitIndex = 0;
    window.moveWave = 0;
    window.isExploring = false;
    window.isBombarding = false;
    window.isUnloading = false;
    window.isBattleSelected = false;
    if (resetButton)
    {
        resetKomputerButtonStyle(false);
        window.IS_KOMPUTER_READY = true;
    }
}


function runKomputer(thisGame)
{
    console.log("Checking movePhase.");
    switch(thisGame.movePhase)
    {
        case 0:
            console.log("Game won.");
            setTimeout(function(){
                window.IS_KOMPUTER_READY = true;
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
            console.log("Unhandled movePhase: " + thisGame.movePhase);
    }
}


function placeCapital(thisGame)
{
    // Explore 5 hexes, handle water
    let hexOrder = thisGame.getMapCustomizationData();
    const hasWater = (hexOrder.indexOf("w") > -1) ? true : false;
    if (hasWater)
    {
        while (waterCount(hexOrder) > 2)
        {
            thisGame.swapWaterForLand();
            hexOrder = thisGame.getMapCustomizationData();
        }
        thisGame.playOptions.mapCustomizationData = [hexOrder[0], hexOrder[4], hexOrder[1], hexOrder[3], hexOrder[2]].join("");
    }
    thisGame.customizeMapDoAll(true);

    // Place capital & explore adjacent, using a bit of advice from Peter M's strategy guide.
    let pieceIndexChoices = (thisGame.player.team.color === 0) ? [7, 9, 24] : [36, 51, 53];
    let pieceIndex = (thisGame.player.team.color === 0) ? getRandomItem(pieceIndexChoices) : getSecondCapitalPieceIndex(thisGame, pieceIndexChoices);
    let destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
    thisGame.placeCapitalMouseDown(destinationScreenPoint);
    thisGame.overlayCommitOnClick();
    const customizeMapDelay1 = 800;
    setTimeout(function(){
        const waterPopup = document.getElementById("Foundation_Elemental_7_waterSwap");
        if (waterPopup)
        {
            thisGame.swapWaterForLand();
            console.log("Water swap!");
        }
        thisGame.customizeMapDoAll(true);
        if (thisGame.player.team.color === 0)
        {
            thisGame.endMyTurn();
            window.IS_KOMPUTER_READY = true;
            resetKomputerButtonStyle();
            console.log("Done.");
        }
        // Place first town. This reserve phase plays a bit slower than later in the game.
        else
        {
            if (thisGame.movePhase === 11)
            {
                thisGame.reserveOnMouseDown(thisGame, thisGame.event("reserveOnMouseDown(this,event,#)"), 0);
                // thisGame.reserveOnMouseDown(thisGame, function(){return true},0);
                pieceIndex = (pieceIndex < 51) ? pieceIndexChoices[0] : (pieceIndex > 51) ? pieceIndexChoices[1]: getRandomItem(pieceIndexChoices);
                destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                thisGame.placeReserveOnMouseUp(destinationScreenPoint)
                thisGame.overlayCommitOnClick();
                const customizeMapDelay2 = 1000;
                setTimeout(function(){
                    const waterPopup = document.getElementById("Foundation_Elemental_7_waterSwap");
                    if (waterPopup)
                    {
                        thisGame.swapWaterForLand();
                        console.log("Water swap!");
                    }
                    thisGame.customizeMapDoAll(true);
                    thisGame.reserveOnMouseDown(thisGame, thisGame.event("reserveOnMouseDown(this,event,#)"), 0);
                    // thisGame.reserveOnMouseDown(thisGame, function() {return true},0);
                    thisGame.placeReserveOnMouseUp( destinationScreenPoint );
                    thisGame.endMyTurn();
                    window.IS_KOMPUTER_READY = true;
                    resetKomputerButtonStyle();
                    console.log("Done.");
                }, customizeMapDelay2);
            }
        }}, customizeMapDelay1);
}


function waterCount(stringHexData)
{
      let count = 0;
      for (let i = 0; i < stringHexData.length; i++)
      {
          if (stringHexData.charAt(i)==="w")
          {
              count++;
          }
      }
      return count;
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


function getSecondCapitalPieceIndex(thisGame, pieceIndexChoices)
{
    // Usually take the opposite side of the opponent, or if center, play random.
    const randomMoveChance = 0.125;
    if (Math.random() < randomMoveChance || thisGame.pieces[9].hasUnit(0, "C"))
    {
        return pieceIndexChoices.splice(getRandomIndexExclusive(pieceIndexChoices.length), 1);
    }
    else
    {
        const opponentCapitalPiece = thisGame.pieces.findCapitalPiece(0);
        if (opponentCapitalPiece.index < 9)
        {
            return pieceIndexChoices.pop();
        }
        else
        {
            return pieceIndexChoices.shift();
        }
    }
}


function moveUnits(thisGame)
{
    const moveIntervalPeriod = 1000;
    const moveDelay = 400;
    setTimeout(async function(){
        switch (window.moveWave)
        {
            case 0: {
                console.log("May move land units.");
                const landUnits = getAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                moveEachUnitByInterval(thisGame, landUnits, moveIntervalPeriod);
                break;
            }
            case 1: {
                console.log("May move frigates.");
                const frigates = getFrigates(thisGame, thisGame.perspectiveColor);
                moveEachUnitByInterval(thisGame, frigates, moveIntervalPeriod);
                break;
            }
            case 2: {
                console.log("May move all available.");
                const landUnits = getAvailableLandUnits(thisGame, thisGame.perspectiveColor);
                const frigates = getFrigates(thisGame, thisGame.perspectiveColor);
                const allMilitaryUnits = landUnits.concat(frigates);
                moveEachUnitByInterval(thisGame, allMilitaryUnits, moveIntervalPeriod);
                break;
            }
            case 3:{
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
            }
        }
    }, moveDelay);
}


function getAvailableLandUnits(thisGame, color)
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
            if (unit.color === color && unit.type !== "f" && ( unit.canMove() || unit.canBombard()) )
            {
                landUnits.push(unit);
            }
        }
    }
    return landUnits;
}


function getFrigates(thisGame, color)
{
    let frigates = [];
    for (const piece of thisGame.pieces)
    {
        // Skip reserve units
        if (piece.valueIndex === - 1)
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
    thisGame.endMyMovement();
    window.moveIntervalId = await setInterval(function(){
        if (thisGame.movePhase === 11)
        {
            clearInterval(window.moveIntervalId);
            runKomputer(thisGame);
        }
        else if(window.currentPLayerTurn !== thisGame.perspectiveColor)
        {
            clearInterval(window.moveIntervalId);
            window.IS_KOMPUTER_READY = true;
            resetKomputerButtonStyle();
            console.log("Done.");
        }
        else
        {
            thisGame.endMyMovement();
        }
    }, 200);
}


async function moveEachUnitByInterval(thisGame, movableUnits, intervalPeriod)
{
    window.moveIntervalId = await setInterval(function(){
        // Get the unit to move.
        let unit = movableUnits[window.movingUnitIndex];
        // On the initial wave, don't let cavalry move, so that they can better support slow units.
        const shouldMoveThisWave = (window.moveWave > 0) ? true : (unit && unit.type === "c") ? false : true;
        const finalMoveWave = 2;
        if (unit && shouldMoveThisWave && !window.isExploring && !window.isBombarding)
        {
            if (!unit.movementComplete || unit.hasUnloadables())
            {
                const possibleMoves = unit.getMovables();
                if (possibleMoves)
                {
                    // Decide destination and make move.
                    const pieceIndex = getBestMove(thisGame, possibleMoves, unit).index;
                    const shouldAcceptMove = decideMoveAcceptance(thisGame, unit, pieceIndex);
                    if (shouldAcceptMove)
                    {
                        // Move unit.
                        let originScreenPoint = unit.screenPoint;
                        moveUnitSimulateMouseDown(thisGame, originScreenPoint);
                        let destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                        moveUnitSimulateMouseUp(thisGame, destinationScreenPoint);
                        // Commit to explore after some processing time.
                        const normalPopup = document.getElementById("Foundation_Elemental_7_overlayCommit");
                        if (normalPopup || document.getElementById("Foundation_Elemental_7_customizeMapDoAll") )
                        {
                            if (normalPopup)
                            {
                                thisGame.overlayCommitOnClick();
                            }
                            setTimeout(function(){
                                const waterPopup = document.getElementById("Foundation_Elemental_7_waterSwap");
                                if (waterPopup)
                                {
                                    thisGame.swapWaterForLand();
                                    console.log("Water swap!");
                                }
                                setTimeout(function(){
                                    thisGame.customizeMapDoAll(true);
                                    window.isExploring = false;
                                }, 100);
                            }, 400);
                            window.isExploring = true;
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
                    } // End if shouldAcceptMove
                } // End if possibleMoves
            } // End if not movementComplete or hasUnloadables
        }// End if unit check
        // Decide how to continue
        if (window.isExploring || window.isBombarding || window.isUnloading)
        {
            // Pass: wait for exploring, bombarding, or unloading  to finish.
        }
        // Bombard on the final wave.
        else if (window.moveWave === finalMoveWave &&
                 unit && unit.canBombard() && unit.piece && unit.getBombardables())
        {
            window.isBombarding = true;
            bombard(thisGame, unit, unit.getBombardables());
        }
        else if ( (window.movingUnitIndex + 1) < movableUnits.length )
        {
            // Move the next unit next interval.
            window.movingUnitIndex++;
        }
        else
        {
            // Clear wave interval, reset moving unit index, cue next.
            clearInterval(window.moveIntervalId);
            window.movingUnitIndex = 0;
            window.moveWave++;
            runKomputer(thisGame);
        }
    }, intervalPeriod);
}


function getBestMove(thisGame, possibleMoves, unit)
{
    let bestMoveScore = -1;
    let bestMoves = [];
    for (const possibleMove of possibleMoves)
    {
        const possibleMoveScore = getMoveScore(thisGame, possibleMove, unit);
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


function getMoveScore(thisGame, possibleMove, unit)
{
    let score = 0;
    const piece = thisGame.pieces.findAtXY(possibleMove.x, possibleMove.y);
    const terrainDefenseBonus = piece.terrainDefenses() ? 0.08 * piece.terrainDefenses() : 0.07;
    if (piece.hasRollingOpponent(thisGame.perspectiveColor))
    {
        const enemyColor = thisGame.perspectiveColor === 0 ? 1 : 0;
        const defendingUnitCount = piece.countOpponentMilitary(thisGame.perspectiveColor);
        const defendingRollCount = piece.numDefenderRolls(piece.getOpponentColor(thisGame.perspectiveColor));
        const defensivePower = (0.08 * defendingRollCount) + (0.04 * defendingUnitCount);

        // Check enemy cities & towns.
        if (piece.hasOpponentCivilization(thisGame.perspectiveColor))
        {
            // Urgently try to retake a lost capital.
            if (piece.hasCapital(thisGame.perspectiveColor))
            {
                score = 1;
            }
            // Send any loaded frigate to attack the weakest enemy civ.
            else if (unit.isFrigate())
            {
                score = 0.99 - (defendingUnitCount * 0.0125);
            }
            // Look for undefended enemy towns.
            else if (defendingUnitCount === 0)
            {
                score = piece.hasCapital(enemyColor) ? 0.99 : 0.95;
            }
            // Then look at weaker enemy towns.
            else
            {
                score = 1 - defensivePower;
            }

            // Randomly increase priority of attack.
            score += 0.125 * Math.random() + (1 - score) * Math.random() * 0.25;
        }
        // Check enemy in the countryside.
        else
        {
            score = 0.9 - defensivePower;
            // Prioritize enemy beseiging / pinning a friendly town.
            if (hasAdjacentCivilization(thisGame, piece))
            {
                score = unit.isFrigate() ? piece.hasFrigate(enemyColor) && unit.hasUnloadables() ? 0 : 0.96 : (score + (0.125 * Math.random()));
            }
        }
        // More likely join battles already begun.
        if (piece.hasBattle(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
        {
            score += 0.1875;
        }
    }
    // Try to beseige / pin enemy cities and towns.
    else if (hasAdjacentEnemyCivilization(thisGame, piece))
    {
        score = unit.isFrigate() ? unit.hasUnloadables() ? 0.90 : 0.7 : 0.7 + terrainDefenseBonus;
    }
    // Give importance to own civ defense.
    else if (piece.hasCivilization(thisGame.perspectiveColor) || unit.isFrigate() && hasAdjacentCivilization(thisGame, piece))
    {
        const civilization = piece.hasCivilization(thisGame.perspectiveColor) ? piece : findAdjacentCivilization(thisGame, piece);
        const civDefenderCount = civilization.getMilitaryUnitCount(thisGame.perspectiveColor);
        const civRollCount = civilization.numDefenderRolls(thisGame.perspectiveColor);
        const defensivePower = (2 * civRollCount) + civDefenderCount;

        const threat = guessThreat(thisGame, piece);
        score = defensivePower < threat ? civilization.hasCapital(thisGame.perspectiveColor) || (civDefenderCount === 0) ? 0.96 : 0.84 + (0.06 * Math.random()): 0;
    }
    // Consider boarding a frigate.
    else if (!unit.isFrigate() && piece.hasFrigate(thisGame.perspectiveColor)) // "false" indicates not retreating.
    {
        score = 0.82;
        // More likely board if others on board.
        if (piece.findFrigate(thisGame.perspectiveColor).cargo.length > 0)
        {
            score += 0.125;
        }
    }
    // Move towards a friend / enemy target, ending on the safest terrain.
    else
    {
        // Unloaded frigates should support friendlies
        let targetFound = false;
        if (unit.isFrigate() && !unit.hasUnloadables())
        {
            let friendlyArmyUnits = getArmyUnits(thisGame, thisGame.perspectiveColor);
            if (friendlyArmyUnits)
            {
                const distance = getDistanceToNearestUnit(thisGame, friendlyArmyUnits, piece);
                score = 1 / distance;
                targetFound = true;
            }
        }
        // Loaded frigates should move toward enemy coastal towns
        else if (unit.isFrigate() && unit.hasUnloadables())
        {
            let enemyCivs = thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor);
            let distance = getDistanceToNearestCoastalCiv(thisGame, enemyCivs, piece);
            if (distance !== -1)
            {
                score = 1 / distance;
                targetFound = true;
            }
        }
        // Otherwise move toward any enemy
        if (!targetFound)
        {
            const enemyColor = thisGame.perspectiveColor === 0 ? 1 : 0;
            const enemyArmies = getArmyUnits(thisGame, enemyColor);
            let enemyTarget = enemyArmies ? getRandomItem(enemyArmies) : getRandomItem(thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor)).findCivilization(enemyColor);
            const distanceToEnemy = thisGame.distanceBewteenPoints(enemyTarget.piece.boardPoint, piece.boardPoint);
            score = 0.56 + (terrainDefenseBonus / (distanceToEnemy * 3));
            if (hasAdjacentHiddenTerrain(thisGame, piece))
            {
                score += 0.125;
            }
        }
    }
    // Clamp score between [0,1].
    score = score < 0 ? 0 : score > 1 ? 1 : score;
    return score;
}


function hasAdjacentCivilization(thisGame, piece)
{
      let adjacentPiece;
      return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor));
}


function findAdjacentCivilization(thisGame, piece)
{
      let adjacentPiece;
      return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ||
          ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.hasCivilization(thisGame.perspectiveColor)) ? adjacentPiece : null;
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
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && adjacentPiece.isWater()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && adjacentPiece.isWater()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && adjacentPiece.isWater()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && adjacentPiece.isWater()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && adjacentPiece.isWater()) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && adjacentPiece.isWater());
}


function hasAdjacentEnemyArmy(thisGame, piece)
{
    const enemyColor = thisGame.perspectiveColor === 0 ? 1 : 0;
    let adjacentPiece;
    return ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x-1, piece.boardPoint.y-1)) != null && hasArmy(adjacentPiece, enemyColor)) ||
        ((adjacentPiece = thisGame.pieces.findAtXY(piece.boardPoint.x+1, piece.boardPoint.y+1)) != null && hasArmy(adjacentPiece, enemyColor));
}


function hasArmy(piece, color)
{
    return (piece.hasInfantry(color) || piece.hasArtillery(color) || piece.hasCavalry(color));
}


function guessThreat(thisGame, piece)
{
    const enemyColor = thisGame.perspectiveColor === 0 ? 1 : 0;
    const enemyArmyUnits = getArmyUnits(thisGame, enemyColor);
    if (!enemyArmyUnits)
    {
        return 0;
    }

    let threatCount = 0;
    let hasInfantry = false;
    let hasCavalry = false;
    let hasArtillery = false;

    for (const unit of enemyArmyUnits)
    {
        let inRangePoints = unit.getMovables();
        if (!inRangePoints)
        {
            continue;
        }
        for (const point of inRangePoints)
        {
            if (point.x === piece.boardPoint.x && point.y === piece.boardPoint.y)
            {
                threatCount++;
                if (!hasInfantry && unit.isInfantry())
                {
                    hasInfantry = true
                    break;
                }
                if (!hasCavalry && unit.isCavalry())
                {
                    hasCavalry = true;
                    break;
                }
                if (!hasArtillery && unit.isArtillery())
                {
                    hasArtillery = true;
                    break;
                }
                break;
            }
        }
    }
    let enemyFrigates = getFrigates(thisGame, enemyColor);
    for (const frigate of enemyFrigates)
    {
        let amphibEnemyCount = 0;
        let inRangePoints = frigate.getMovables();
        if (!inRangePoints)
        {
            continue;
        }
        for (const point of inRangePoints)
        {
            if (point.x === piece.boardPoint.x && point.y === piece.boardPoint.y)
            {
                if (frigate.cargo.length > 0)
                {
                    amphibEnemyCount += frigate.cargo.length;
                    if (!hasInfantry && frigate.carriesCargo("i"))
                    {
                        hasInfantry = true
                    }
                    if (!hasCavalry && frigate.carriesCargo("c"))
                    {
                        hasCavalry = true;
                    }
                    if (!hasArtillery && frigate.carriesCargo("a"))
                    {
                        hasArtillery = true;
                    }
                }
                const frigateCapacity = 3;
                let loadableUnitCount = 0;
                if (amphibEnemyCount < frigateCapacity && hasAdjacentEnemyArmy(thisGame, frigate.piece))
                {
                    const adjacentPieceIndices = frigate.piece.getAdjacentIndecies(1);
                    for (const adjacentPieceIndex of adjacentPieceIndices)
                    {
                        loadableUnitCount += thisGame.pieces[adjacentPieceIndex].getMilitaryUnitCount(enemyColor);
                        if (loadableUnitCount + amphibEnemyCount >= frigateCapacity)
                        {
                            amphibEnemyCount = frigateCapacity;
                            break;
                        }
                    }
                    amphibEnemyCount += loadableUnitCount;
                }
            } // End if point === inRange
        } // End for each point
        threatCount += amphibEnemyCount;
    } // End for each frigate
    // Estimate likely number of rolls, based on enemy count & type.
    const attackVectorBonus = threatCount < 3 ? 0 : threatCount < 6 ? 1 : threatCount < 10 ? 2 : 3;
    const threatRollCount = attackVectorBonus + hasInfantry + hasCavalry + hasArtillery;
    // Weight to favor rolls and combine to estimate threat.
    return ((2 * threatRollCount) + threatCount);
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


function getDistanceToNearestCoastalCiv(thisGame, enemyCivs, originPiece)
{
    let distance = -1;
    let minDistance = Number.MAX_VALUE;
    for (const civPiece of enemyCivs)
    {
        if (hasAdjacentWater(thisGame, civPiece))
        {
            distance = thisGame.distanceBewteenPoints(civPiece.boardPoint, originPiece.boardPoint);
            if (distance < minDistance)
            {
                minDistance = distance
            }
        }
    }
    return minDistance;
}


function decideMoveAcceptance(thisGame, unit, destinationIndex)
{
    // Consider guarding own town vs attacking.
    if (unit.piece.hasCivilization(thisGame.perspectiveColor) && thisGame.pieces[destinationIndex].hasRollingOpponent(thisGame.perspectiveColor) ||
        unit.piece.hasCivilization(thisGame.perspectiveColor) && unit.piece.hasAdjacentRollingEnemy(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
    {
        if (thisGame.pieces[destinationIndex].hasCapital(thisGame.perspectiveColor))
        {
            return true;
        }
        else if (unit.piece.getMilitaryUnitCount(thisGame.perspectiveColor) === 1)
        {
            return (Math.random() < 0.2) ? true : false;
        }
        else
        {
            return (Math.random() < 0.875) ? true : false;
        }
    }
    // Keep frigates next to target when ready to load / unload.
    if (unit.isFrigate() && unit.hasUnloadables() && hasAdjacentEnemyCivilization(thisGame, unit.piece) && !thisGame.pieces[destinationIndex].hasOpponentCivilization(thisGame.perspectiveColor) ||
       unit.isFrigate() && !unit.hasUnloadables() && hasAdjacentCivilization(thisGame, unit.piece) && hasArmy(findAdjacentCivilization(thisGame, unit.piece), thisGame.perspectiveColor))
    {
        return false;
    }

    return true;
}


function bombard(thisGame, unit, bombardablePoints)
{
    thisGame.bombardUnitsMouseDown(unit.screenPoint);
    const targetPoint = getBestTargetPoint(thisGame, bombardablePoints);
    const targetScreenPoint = thisGame.pieces.findAtPoint(targetPoint).$screenRect.getCenter();
    const fireDelay = 200;
    setTimeout(function(){
        const hasFired = simulateBombardUnitsMouseUp(thisGame, targetScreenPoint);
        if (hasFired)
        {
            const commitDelay = 100;
            setTimeout(function(){
                thisGame.overlayCommitOnClick();
                // Apply hits.
                const applyHitsDelay = 200;
                setTimeout(function(){
                    if (thisGame.battleData)
                    {
                        const data = thisGame.getBattleData();
                        if (data && data.piece.defenderBattleInfo &&
                            data.piece.defenderBattleInfo.decisionNeeded)
                        {
                            applyHits(thisGame, data.piece.index, data);
                        }
                    }
                    const reviewDelay = 400;
                    setTimeout(function(){
                        thisGame.pieces[unit.piece.index].bombardOkClick(thisGame.player.team.color);
                        unit.hasBombarded = unit.noBombard = unit.movementComplete = true;
                        console.log("Bombardment!");
                        window.isBombarding = false;
                    }, reviewDelay)
                }, applyHitsDelay);
            }, commitDelay);
        } // End if hasFired
        else
        {
            // Fix for rare, infinitely looping bug where unit tries to fire multiple times.
            unit.hasBombarded = true;
            unit.noBombard = true;
            unit.movementComplete = true;
            window.isBombarding = false;
        }
    }, fireDelay);
}


function getBestTargetPoint(thisGame, bombardablePoints)
{
    for (const bombardablePoint of bombardablePoints)
    {
        const piece = thisGame.pieces.findAtPoint(bombardablePoint);
        if (piece && piece.hasBattle(thisGame.player.team.color, thisGame.player.team.rulerColor) && piece.hasNonRulingOpponentMilitary(thisGame.perspectiveColor, thisGame.player.team.rulerColor))
        {
            return bombardablePoint;
        }
    }
    return getRandomItem(bombardablePoints);
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


function fightBattle(thisGame, battlePiece)
{
    // Clear any exploration popup
    const explorationPopup = document.getElementById("Foundation_Elemental_7_overlayCommit");
    if (explorationPopup || document.getElementById("Foundation_Elemental_7_customizeMapDoAll") )
    {
        if (explorationPopup)
        {
            thisGame.overlayCommitOnClick();
        }
    }
    // Select battle
    if (!window.isBattleSelected)
    {
        thisGame.moveUnitsMouseDown(battlePiece.$screenRect.getCenter());
        window.isBattleSelected = true;
    }
    // Do prebattle artillery
    if (document.getElementById("Foundation_Elemental_7_battleOk"))
    {
        battlePiece.preBattleOkClick(thisGame.player.team.color);
    }
    // Roll loop
    const rollDelay = 200;
    setTimeout(function roll(){
        thisGame.overlayCommitOnClick();
        // Apply hits.
        const applyHitsDelay = 200;
        setTimeout(function(){
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
            // Close battle after review time, if game not won, then reroll or continue game.
            const battleReviewDelay = 1600;
            setTimeout(function(){
                if (thisGame.movePhase !== 0)
                {
                    thisGame.pieces[battlePiece.index].battleOkClick(thisGame.player.team.color);
                    const reRollDelay = 600;
                    setTimeout(function(){
                        if (document.getElementById("Foundation_Elemental_7_overlayCommit"))
                        {
                            roll();
                        }
                        else
                        {
                            window.isBattleSelected = false;
                            runKomputer(thisGame);
                        }
                    }, reRollDelay);
                }
                // Game won. Leave battle on screen and end.
                else
                {
                    window.IS_KOMPUTER_READY = true;
                    resetKomputerButtonStyle(true);
                    console.log("Viktory.");
                }
            }, battleReviewDelay);
        }, applyHitsDelay);
    }, rollDelay);

}


function applyHits(thisGame, pieceIndex, battleData)
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
        const hitCount = (thisPiece.defenderBattleInfo.numHit - thisPiece.defenderBattleInfo.numTacticalHit);
        thisPiece.hitHighestMilitaryUnits(defenderUnitList, hitCount, false);
    }
    // Check if attackers are present, since attackers may be bombarding, and bombarding units never take hits.
    if (attackerUnitList.length > 0)
    {
        thisPiece.attackerBattleInfo = thisPiece.getBattleInfo(attackerUnitList, battleData.defenderRolls, defenderHitThreshold,false);
        // Choose lowest value hits on the attacker.
        if (thisPiece.attackerBattleInfo.decisionNeeded)
        {
            const hitCount = (thisPiece.attackerBattleInfo.numHit - thisPiece.attackerBattleInfo.numTacticalHit);
            thisPiece.hitLowestMilitaryUnits(attackerUnitList, hitCount, false);
        }
    }
    setTimeout(function(){ thisPiece.battleOkClick(attackerColor) }, 200);
}


async function placeReserves(thisGame)
{
    resetGlobals();
    // Place reserves
    window.reserveIntervalId = await setInterval(placeReserveUnit, 1100, thisGame);
}


function placeReserveUnit(thisGame){
    const reserveUnits = thisGame.player.team.reserveUnits;
    const controlsCapital = thisGame.doesColorControlTheirCapital(thisGame.player.team.color);
    let hasPlayableReserveUnit = false;
    if (thisGame.movePhase === 11 && reserveUnits.length > 0)
    {
        for (let i = 0; i < reserveUnits.length; i++)
        {
            if (thisGame.couldPlaceReserveUnit(reserveUnits[i], thisGame.player.team.color, controlsCapital))
            {
                thisGame.reserveOnMouseDown(thisGame, function(){return true},i);
                //thisGame.reserveOnMouseDown(thisGame, thisGame.event("reserveOnMouseDown(this,event,#)"), i);
                hasPlayableReserveUnit = true;
                break;
            }
        }
    }
    // Place reserve unit on a valid destination
    if (hasPlayableReserveUnit)
    {
        const movingUnitType = thisGame.pieces.getNewPiece().movingUnit.type;
        const destinationBoardPoint = (movingUnitType === "t" || movingUnitType === "y") ? (
            getBestBuildable(thisGame) ) : (
            getBestReservable(thisGame, movingUnitType, controlsCapital) );
        const destinationScreenPoint = thisGame.screenRectFromBoardPoint(destinationBoardPoint).getCenter();
        thisGame.placeReserveOnMouseUp(destinationScreenPoint);
        if (document.getElementById("Foundation_Elemental_7_overlayCommit"))
        {
            thisGame.overlayCommitOnClick();
            setTimeout(function(){
                const waterPopup = document.getElementById("Foundation_Elemental_7_waterSwap");
                if (waterPopup)
                {
                    thisGame.swapWaterForLand();
                    console.log("Water swap!");
                }
                setTimeout(function(){
                    thisGame.customizeMapDoAll(true);
                }, 100);
            }, 700);
        }
    }
    // End placing reserves. Check for battle, then make ready for next player.
    else
    {
        const battlePiece = findNextBattle(thisGame);
        if (battlePiece)
        {
            console.log("Handling reserve battle.");
            fightBattle(thisGame, battlePiece);
        }
        else
        {
            clearInterval(window.reserveIntervalId);
            if (window.currentPlayerTurn === thisGame.perspectiveColor)
            {
                thisGame.endMyTurn();
            }
            thisGame.movePhase = 5;
            window.IS_KOMPUTER_READY = true;
            resetKomputerButtonStyle();
            console.log("Done.");
        }
    }
}


function getBestBuildable(thisGame)
{
    // Check if already in Combat Suppy
    if (thisGame.qualifiesForCombatSupply(thisGame.perspectiveColor))
    {
        return getRandomItem(thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor));
    }
    // Check what terrain towns and cities occupy
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
            continue;
        }
        if (civ.isGrassland())
        {
            hasGrass = true;
            continue;
        }
        if (civ.isForest())
        {
            hasForest = true;
            continue;
        }
        if (civ.isMountain())
        {
            hasMountain = true;
        }
        if (hasPlain && hasGrass && hasForest && hasMountain)
        {
            return getRandomItem(thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor));
        }
    }
    // Find a terrain not yet occupied
    const buildablePoints = thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor);
    let terrainPoint = null;
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
    if (!hasForest)
    {
        terrainPoint = findTerrain(thisGame, buildablePoints, "f")
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
    return getRandomItem(thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor));
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
    // Sort by distance
    sortByDistanceToEnemy(thisGame, reservables);
    // Consider unguarded towns first
    for (const reservable of reservables)
    {
        const piece = thisGame.pieces.findAtPoint(reservable);
        if (!piece.hasMilitary(thisGame.perspectiveColor))
        {
            return reservable;
        }
    }
    return ( reservables.length > 1 ? Math.random() < 0.8 ? reservables[0] : reservables[1] : reservables[0] );
}


/// Sorts closest to farthest.
function sortByDistanceToEnemy(thisGame, reservables)
{
    // Get enemy armies or towns.
    const enemyColor = thisGame.perspectiveColor === 0 ? 1 : 0;
    let enemyArmies = getArmyUnits(thisGame, enemyColor);
    if (!enemyArmies)
    {
        enemyArmies = [getRandomItem(thisGame.pieces.getOpponentCivilizations(thisGame.perspectiveColor)).findCivilization(enemyColor)];
        if (enemyArmies.length === 0)
        {
            return reservables;
        }
    }
    let minimumReservableToEnemyDistances = []
    // Find the closest distance of each reservable point to the enemy.
    for (const reservable of reservables)
    {
        let minDistanceToArmy = Number.MAX_VALUE;
        for (const enemyArmy of enemyArmies)
        {
            const distanceToArmy = thisGame.distanceBewteenPoints(enemyArmy.piece.boardPoint, reservable);
            if (distanceToArmy < minDistanceToArmy)
            {
                minDistanceToArmy = distanceToArmy;
            }
        }
        minimumReservableToEnemyDistances.push(minDistanceToArmy);
    }
    // Sort all reservables based on the closest distance of each to the enemy.
    return (reservables.sort(function(a, b){
        return minimumReservableToEnemyDistances[reservables.indexOf(a)] - minimumReservableToEnemyDistances[reservables.indexOf(b)]})
           );
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


function addButton(text, onclick, pointerToGame) {
    let style = {position: 'absolute', top: '776px', left:'24px', 'z-index': '9999', "-webkit-transition-duration": "0.6s", "transition-duration": "0.6s", overflow: 'hidden', width: '128px'}
    let button = document.createElement('button'), btnStyle = button.style
    document.body.appendChild(button) // For now, this works well enough.
    button.setAttribute("class", "button_runKomputer");
    button.innerHTML = text;
    button.id = "KomputerButton";
    button.onclick = function() {onclick(pointerToGame)};
    Object.keys(style).forEach(key => btnStyle[key] = style[key])

    // Add Button Press Transition 1
    const cssButtonClassString1 = `.button_runKomputer:after{content: ""; background: #90EE90; display: block; position: absolute; padding-top: 300%; padding-left: 350%; margin-left: -20px!important; margin-top: -120%; opacity: 0; transition: all 1.0s}`;
    const styleTag1 = document.createElement("style");
    styleTag1.innerHTML = cssButtonClassString1;
    document.head.insertAdjacentElement('beforeend', styleTag1);

    // Add Button Press Transition 2
    const cssButtonClassString2 = `.button_runKomputer:active:after{padding: 0; margin: 0; opacity: 1; transition: 0s}`;
    const styleTag2 = document.createElement("style");
    styleTag2.innerHTML = cssButtonClassString2;
    document.head.insertAdjacentElement('beforeend', styleTag2);
}


function styleButtonForRun()
{
    let button = document.getElementById("KomputerButton");
    button.style.backgroundColor = 'mediumseagreen';
    button.style.color = 'crimson';
    button.innerHTML = "Running";
}


function resetKomputerButtonStyle(isGameWon = false)
{
    let button = document.getElementById("KomputerButton");
    button.style.backgroundColor = '';
    button.style.color = '';
    button.innerHTML = isGameWon ? "Viktory" : "Run Komputer";
}


function moveUnitSimulateMouseDown(thisGame, screenPoint)
{
    thisGame.maybeResetReservesByMouseUp();
    thisGame.moveBombardUnitsMouseOut(screenPoint=thisGame.constrainPoint(screenPoint));
    thisGame.maybeHideOverlay();
    let unit=thisGame.militaryUnitFromScreenPoint(screenPoint,null,thisGame.player.team.color,thisGame.player.team.rulerColor,true);
    if (unit)
    {
        thisGame.setTargetPoints(unit.getMovables());
        thisGame.onLeftMouseUp="moveUnitsMouseUp";
        thisGame.onMouseMove=null;
        thisGame.onMouseOver=null;
        thisGame.onMouseOut=null;
        let piece=thisGame.pieces.getNewPiece();
        piece.setMovingUnit(unit);
        thisGame.forcingFrigateUnload=(unit.isFrigate() && thisGame.targetPointsAllLand);
        if (thisGame.forcingFrigateUnload)
            unit.centerUnload(screenPoint.subtract(0,5),piece);
        else
        {
            unit.setVisibility(false);
            piece.center(screenPoint.subtract(0,5));
        }
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
            thisGame.showOverlay();
    }
}


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
        else
        if (movingPiece.movingUnit.isFrigate() &&
            targetPiece.isLand())
        {
            let oldPiece=movingPiece.movingUnit.piece;
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
        thisGame.onMouseMove="moveBombardUnitsMouseMove";
        thisGame.onMouseOver="moveBombardUnitsMouseMove";
        thisGame.onMouseOut="moveBombardUnitsMouseOut";
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


function simulateBombardUnitsMouseUp(thisGame, screenPoint)
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


/**
     * Greasemonkey Wrench by CoeJoder, for public use.
     * Source: https://github.com/CoeJoder/GM_wrench/blob/master/src/GM_wrench.js
	 * Detect and handle AJAXed content.  Can force each element to be processed one or more times.
	 *
	 * @example
	 * GM_wrench.waitForKeyElements('div.comments', (element) => {
	 *   element.innerHTML = 'This text inserted by waitForKeyElements().';
	 * });
	 *
	 * GM_wrench.waitForKeyElements(() => {
	 *   const iframe = document.querySelector('iframe');
	 *   if (iframe) {
	 *     const iframeDoc = iframe.contentDocument || iframe.contentwindow.document;
	 *     return iframeDoc.querySelectorAll('div.comments');
	 *   }
	 *   return null;
	 * }, callbackFunc);
	 *
	 * @param {(string|function)} selectorOrFunction The selector string or function.
	 * @param {function}          callback           The callback function; takes a single DOM element as parameter.  If
	 *                                               returns true, element will be processed again on subsequent iterations.
	 * @param {boolean}           [waitOnce=true]    Whether to stop after the first elements are found.
	 * @param {number}            [interval=300]     The time (ms) to wait between iterations.
	 * @param {number}            [maxIntervals=-1]  The max number of intervals to run (negative number for unlimited).
*/
function waitForKeyElements (selectorOrFunction, callback, waitOnce, interval, maxIntervals) {
    if (typeof waitOnce === "undefined") {
        waitOnce = true;
    }
    if (typeof interval === "undefined") {
        interval = 300;
    }
    if (typeof maxIntervals === "undefined") {
        maxIntervals = -1;
    }
    var targetNodes =
        typeof selectorOrFunction === "function"
    ? selectorOrFunction()
    : document.querySelectorAll(selectorOrFunction);

    var targetsFound = targetNodes && targetNodes.length > 0;
    if (targetsFound) {
        targetNodes.forEach(function (targetNode) {
            var attrAlreadyFound = "data-userscript-alreadyFound";
            var alreadyFound = targetNode.getAttribute(attrAlreadyFound) || false;
            if (!alreadyFound) {
                var cancelFound = callback(targetNode);
                if (cancelFound) {
                    targetsFound = false;
                } else {
                    targetNode.setAttribute(attrAlreadyFound, true);
                }
            }
        });
    }

    if (maxIntervals !== 0 && !(targetsFound && waitOnce)) {
        maxIntervals -= 1;
        setTimeout(function () {
            waitForKeyElements(selectorOrFunction, callback, waitOnce, interval, maxIntervals);
        }, interval);
    }
};
