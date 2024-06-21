// ==UserScript==
// @name         Viktory Script
// @namespace    http://tampermonkey.net/
// @version      2024-05-05
// @description  Komputer - an AI for Viktory II
// @author       Wilbo Baggins / Stephen Montague
// @match        http://gamesbyemail.com/Games/Viktory2
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gamesbyemail.com
// @grant unsafeWindow
// ==/UserScript==

// Note - "unsafeWindow" is granted to allow the user to manually unlock the button that runs the AI.
// It's normally locked after each click, to protect against accidental double-clicks.
// Just in case, due to some bug, the button ever gets stuck locked, you can unlock it in the console.
// Open the debugging console (right-click > inspect > console) and type "window.unlockKomputer = true"


(function() {
    // Begin main script.
    console.log("Hello Viktory.");

    // Wait for the page to load.
    waitForKeyElements("#Foundation_Elemental_7_savePlayerNotes", () => {

        // Alias the game.
        let thisGame = Foundation.$registry[7];

        // Add button to page.
        console.log("Adding AI agent control button.");
        addButton("Run Komputer", runKomputerClick, thisGame);

        window.moveIntervalId = null;
        window.movingUnitIndex = 0;
        window.moveWave = 0;
        window.battleIsSelected = false;
        window.clickCount = 0;
        window.IS_KOMPUTER_READY = true;
        unsafeWindow.unlockKomputer = false;
   }); // End wait for page load

})(); // End main script.


function runKomputerClick(thisGame)
{
    if (window.IS_KOMPUTER_READY || unsafeWindow.unlockKomputer === true)
    {
        window.IS_KOMPUTER_READY = false;
        runKomputer(thisGame);
    }
}


function runKomputer(thisGame)
{
    console.log("Checking movePhase.");
    switch(thisGame.movePhase)
    {
        case 0:
            console.log("Game reset.");
            setTimeout(function(){runKomputer(thisGame)}, 600);
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
        thisGame.customizeMapDoAll(true);
        if (thisGame.player.team.color === 0)
        {
            thisGame.endMyTurn();
            window.IS_KOMPUTER_READY = true;
            console.log("Done.");
        }
        // Place first town. This reserve phase plays a bit slower than later in the game.
        else
        {
            if (thisGame.movePhase === 11)
            {
                thisGame.reserveOnMouseDown(thisGame, function(){return true},0);
                pieceIndex = (pieceIndex < 51) ? pieceIndexChoices[0] : (pieceIndex > 51) ? pieceIndexChoices[1]: getRandomItem(pieceIndexChoices);
                destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                thisGame.placeReserveOnMouseUp(destinationScreenPoint)
                thisGame.overlayCommitOnClick();
                const customizeMapDelay2 = 1000;
                setTimeout(function(){
                    thisGame.customizeMapDoAll(true);
                    thisGame.reserveOnMouseDown(thisGame, function() {return true},0);
                    thisGame.placeReserveOnMouseUp( destinationScreenPoint );
                    thisGame.endMyTurn();
                    window.IS_KOMPUTER_READY = true;
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
    const moveIntervalPeriod = 800;
    const moveDelay = 100;
    setTimeout(async function(){
        switch (window.moveWave)
        {
            case 0: {
                console.log("May move land units.");
                const landUnits = getMovableLandUnits(thisGame, thisGame.perspectiveColor);
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
                const landUnits = getMovableLandUnits(thisGame, thisGame.perspectiveColor);
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


function getMovableLandUnits(thisGame, color)
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
            if (unit.color === color && unit.type !== "f" && unit.canMove())
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
    let lastPlayerColor = thisGame.perspectiveColor;
    thisGame.endMyMovement();
    window.moveIntervalId = await setInterval(function(){
        if (thisGame.movePhase === 11)
        {
            clearInterval(window.moveIntervalId);
            runKomputer(thisGame);
        }
        else if(lastPlayerColor !== thisGame.perspectiveColor)
        {
            clearInterval(window.moveIntervalId);
        }
    }, 200);
}


async function moveEachUnitByInterval(thisGame, movableUnits, intervalPeriod)
{
    window.moveIntervalId = await setInterval(function(){
        // Get the unit to move.
        let unit = movableUnits[window.movingUnitIndex];
        let stoppedToExplore = false;
        // On the initial wave, which has only land units, give a 50% chance to move, allowing land units to wait for an incoming frigate.
        const shouldMoveThisWave = (window.moveWave > 0) ? true : ((Math.random() > 0.5) ? true : false);
        if (unit && shouldMoveThisWave)
        {
            let mayBombard = true;
            if (!unit.movementComplete || unit.hasUnloadables())
            {
                const possibleMoves = unit.getMovables();
                if (possibleMoves)
                {
                    // Get destination and track any pending battle.
                    const pieceIndex = getRandomItem(possibleMoves).index;
                    if (thisGame.pieces[pieceIndex].hasRollingOpponent(thisGame.player.team.color))
                    {
                        mayBombard = false;
                    }
                    // Move unit.
                    let originScreenPoint = unit.screenPoint;
                    moveUnitSimulateMouseDown(thisGame, originScreenPoint);
                    let destinationScreenPoint = thisGame.pieces[pieceIndex].$screenRect.getCenter();
                    moveUnitSimulateMouseUp(thisGame, destinationScreenPoint);
                    // Commit to explore after some processing time.
                    let normalPopup = document.getElementById("Foundation_Elemental_7_overlayCommit");
                    if (normalPopup || document.getElementById("Foundation_Elemental_7_customizeMapDoAll"))
                    {
                        if (normalPopup)
                        {
                            thisGame.overlayCommitOnClick();
                        }
                        setTimeout(function(){thisGame.customizeMapDoAll(true)}, 400);
                        stoppedToExplore = true;
                    }
                } // End if possibleMoves
            } // End if not movementComplete or hasUnloadables
            // Bombard on the final wave.
            const isTimeToBombard = (!stoppedToExplore && window.moveWave === 2) ? true : false;
            if (isTimeToBombard)
            {
                if (mayBombard && unit.canBombard() && unit.piece !== null)
                {
                    const bombardablePoints = unit.getBombardables();
                    if (bombardablePoints)
                    {
                        bombard(thisGame, unit, bombardablePoints);
                    }
                }
            }
        }// End if unit check
        // Decide how to continue
        if (stoppedToExplore && !unit.movementComplete)
        {
            // Pass: move same unit next interval.
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


function bombard(thisGame, unit, bombardablePoints)
{
    thisGame.bombardUnitsMouseDown(unit.screenPoint);
    const randomTargetPoint = getRandomItem(bombardablePoints);
    const targetScreenPoint = thisGame.pieces.findAtPoint(randomTargetPoint).$screenRect.getCenter();
    const firingDelay = 100;
    setTimeout(function(){
        thisGame.bombardUnitsMouseUp(targetScreenPoint);
        const commitDelay = 100;
        setTimeout(function(){
            thisGame.overlayCommitOnClick();
            // Apply hits.
            const applyHitsDelay = 100;
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
                }, reviewDelay)
            }, applyHitsDelay);
        }, commitDelay);
    }, firingDelay);
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
    // Select battle
    if (!window.battleIsSelected) // Todo: handle humans starting the Komputer in the middle of a turn, like at the start of a battle.
    {
        thisGame.moveUnitsMouseDown(battlePiece.$screenRect.getCenter());
        window.battleIsSelected = true;
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
            // Close battle after review.
            const battleReviewDelay = 1600;
            setTimeout(function(){
                thisGame.pieces[battlePiece.index].battleOkClick(thisGame.player.team.color);
                const reRollDelay = 600;
                setTimeout(function(){
                    if (document.getElementById("Foundation_Elemental_7_overlayCommit"))
                    {
                        roll();
                    }
                    else
                    {
                        window.battleIsSelected = false;
                        runKomputer(thisGame);
                    }
                }, reRollDelay);
            }, battleReviewDelay);
        }, applyHitsDelay);
    }, rollDelay);

}


function applyHits(thisGame, pieceIndex, battleData)
{
    const thisPiece = thisGame.pieces[pieceIndex];
    const attackerColor = thisGame.player.team.color;
    const defenderColor = (attackerColor === 0) ? 1 : 0;
    const attackerUnitList = thisPiece.getMilitaryUnitList(attackerColor);
    const defenderUnitList = thisPiece.getDefenderUnitList(defenderColor);
    const attackerHitThreshold = thisGame.getHitThreshold(attackerColor);
    const defenderHitThreshold = thisGame.getHitThreshold(defenderColor);
    thisPiece.defenderBattleInfo = thisPiece.getBattleInfo(defenderUnitList, battleData.attackerRolls, attackerHitThreshold,true);
    thisPiece.attackerBattleInfo = thisPiece.getBattleInfo(attackerUnitList, battleData.defenderRolls, defenderHitThreshold,false);
    // Choose highest value hits on the defender.
    if (thisPiece.defenderBattleInfo.decisionNeeded)
    {
        const hitCount = (thisPiece.defenderBattleInfo.numHit - thisPiece.defenderBattleInfo.numTacticalHit);
        thisPiece.hitHighestMilitaryUnits(defenderUnitList, hitCount, false);
    }
    // Choose lowest value hits on the attacker.
    if (thisPiece.attackerBattleInfo.decisionNeeded)
    {
        const hitCount = (thisPiece.attackerBattleInfo.numHit - thisPiece.attackerBattleInfo.numTacticalHit);
        thisPiece.hitLowestMilitaryUnits(attackerUnitList, hitCount, false);
    }
    setTimeout(function(){ thisPiece.battleOkClick(attackerColor) }, 200);
}


async function placeReserves(thisGame)
{
    // Just in case, clear and reset previous.
    clearInterval(window.moveIntervalId);
    clearInterval(window.reserveIntervalId);
    window.battleIsSelected = false;
    window.movingUnitIndex = 0;
    window.moveWave = 0;
    window.reserveIntervalId = await setInterval(placeReserveUnit, 1000, thisGame);
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
                thisGame.reserveOnMouseDown(thisGame, function(){return true}, i);
                hasPlayableReserveUnit = true;
                break;
            }
        }
        // Place reserve unit on a valid destination
        if (hasPlayableReserveUnit)
        {
            const movingUnitType = thisGame.pieces.getNewPiece().movingUnit.type;
            const destinationBoardPoint = (movingUnitType === "t" || movingUnitType === "y") ? (
                getRandomItem(thisGame.getBuildables(thisGame.player.team.color, thisGame.player.team.rulerColor)) ) : (
                getRandomItem(thisGame.pieces.getReservables(thisGame.player.team.color,thisGame.player.team.rulerColor,movingUnitType, controlsCapital)) );
            const destinationScreenPoint = thisGame.screenRectFromBoardPoint(destinationBoardPoint).getCenter();
            thisGame.placeReserveOnMouseUp(destinationScreenPoint);
            if (document.getElementById("Foundation_Elemental_7_overlayCommit"))
            {
                thisGame.overlayCommitOnClick();
            }
            setTimeout(function(){thisGame.customizeMapDoAll(true);}, 800);
        }
    }
    // End of reserves - ensure ready for next player.
    else
    {
        clearInterval(window.reserveIntervalId);
        window.IS_KOMPUTER_READY = true;
        console.log("Done.");
    }
}


function addButton(text, onclick, pointerToGame) {
    let style = {position: 'absolute', top: '776px', left:'24px', 'z-index': '9999', "-webkit-transition-duration": "0.6s", "transition-duration": "0.6s", overflow: 'hidden'}
    let button = document.createElement('button'), btnStyle = button.style
    //let parent = document.getElementById("Foundation_Elemental_7_bottomTeamTitles"); // Todo: add something like this for better control of position relative to parent.
    //parent.appendChild(button);  // This hides the button under other elements, regardless of z-index. Maybe, instead, add the element via GBE framework.
    document.body.appendChild(button) // For now, this works well enough.
    button.setAttribute("class", "button_runKomputer");
    button.innerHTML = text
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
