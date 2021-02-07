import { attackRoll, getPowerLevel } from './item.js';
import { prepareRollAttribute } from "../common/dialog.js";
import { upgradeDice } from './roll.js';

export class SymbaroumActor extends Actor {
  
    prepareData() {
        super.prepareData();
        this._initializeData(this.data);
        this.data.data.numRituals = 0;
        this._computeItems(this.data);
        this._computeSecondaryAttributes(this.data);
    }

    _initializeData(data) {
        data.data.combat = {
            id: null,
            name: "Armor",
            data: {
                baseProtection: "0",
                bonusProtection: "",
                impeding: 0,
                qualities: {
                    flexible: false,
                    cumbersome: false,
                    concealed: false,
                    reinforced: false,
                    hallowed: false,
                    retributive: false,
                    desecrated: false
                }
            }
        };
        data.data.bonus = {
            defense: 0,
            defense_msg: "",
            accurate: 0,
            accurate_msg: "",
            cunning: 0,
            cunning_msg: "",
            discreet: 0,
            discreet_msg: "",
            persuasive: 0,
            persuasive_msg: "",
            quick: 0,
            quick_msg: "",
            resolute: 0,
            resolute_msg: "",
            strong: 0,
            strong_msg: "",
            vigilant: 0,
            vigilant_msg: "",
            toughness: { 
              max: 0, 
              max_msg: "",
              threshold: 0,
              threshold_msg: "" 
            },
            corruption: { 
              max: 0, 
              max_msg: "",
              threshold: 0,
              threshold_msg: ""
            },
            experience: { 
              value: 0,
              value_msg: "",
              cost: 0,
              cost_msg: ""
            }
        };
    }

    _computeItems(data) {
        for (let item of Object.values(data.items)) {
            item.isTrait = item.type === "trait";
            item.isAbility = item.type === "ability";
            item.isMysticalPower = item.type === "mysticalPower";
            item.isRitual = item.type === "ritual";
            item.isBurden = item.type === "burden";
            item.isBoon = item.type === "boon";
            item.isPower = item.isTrait || item.isAbility || item.isMysticalPower || item.isRitual || item.isBurden || item.isBoon;
            if (item.isPower) this._computePower(data, item);
            item.isWeapon = item.type === "weapon";
            item.isArmor = item.type === "armor";
            item.isEquipment = item.type === "equipment";
            item.isArtifact = item.type === "artifact";
            item.isGear = item.isWeapon || item.isArmor || item.isEquipment || item.isArtifact
            if (item.isGear) this._computeGear(data, item);
        }
    }

    _computeSecondaryAttributes(data) {
        for (var aKey in data.data.attributes) {
          data.data.attributes[aKey].total = data.data.attributes[aKey].value + data.data.bonus[aKey];
          data.data.attributes[aKey].msg = `${game.i18n.localize("TOOLTIP.BONUS_TOTAL")} ${data.data.attributes[aKey].total} ${data.data.bonus[aKey + "_msg"]}`;
        }
        
        let strong = data.data.attributes.strong.total;
        let sturdy = this.items.filter(item => item.data.data.reference === "sturdy");
        if(sturdy.length != 0){
            let sturdyLvl = getPowerLevel(sturdy[0]).level;
            if(sturdyLvl == 1) data.data.health.toughness.max = Math.ceil(strong*(1.5));
            else data.data.health.toughness.max = strong*(sturdyLvl)
        }
        else data.data.health.toughness.max = (strong > 10 ? strong : 10) + data.data.bonus.toughness.max;       
        data.data.health.toughness.threshold = Math.ceil(strong / 2) + data.data.bonus.toughness.threshold;
        
        let resolute = data.data.attributes.resolute.total;        
        data.data.health.corruption.threshold = Math.ceil(resolute / 2) + data.data.bonus.corruption.threshold;
        data.data.health.corruption.max = resolute + data.data.bonus.corruption.max;
        
        let corr = data.data.health.corruption;
        corr.value = corr.temporary + corr.longterm + corr.permanent;
        
        let activeArmor = this._getActiveArmor(data);
        let attributeDef = data.data.defense.attribute.toLowerCase();
        let attDefValue = data.data.attributes[attributeDef].total;
        let defMsg = `${game.i18n.localize(data.data.attributes[attributeDef].label)} ${data.data.attributes[attributeDef].total}`;
        let flagBerserk = this.getFlag(game.system.id, 'berserker');
        if(flagBerserk && flagBerserk < 3){
            attDefValue = 5;
            defMsg = `${game.i18n.localize("ABILITY_LABEL.BERSERKER")} 5`;
        }
        defMsg += `<br/>${game.i18n.localize("ARMOR.IMPEDING")}(${-1 * activeArmor.impeding})${data.data.bonus.defense_msg}`;
        let robust = this.items.filter(element => element.data.data?.reference === "robust");
        if(robust.length > 0){
            let powerLvl = getPowerLevel(robust[0]);
            attDefValue -=  powerLvl.level + 1;
            defMsg += `<br/>${game.i18n.localize("TRAIT_LABEL.ROBUST")}(${-1 * (powerLvl.level + 1)})`;
        }
        data.data.combat = {
            id: activeArmor._id,
            armor: activeArmor.name,
            protectionPc: activeArmor.pc,
            protectionNpc: activeArmor.npc,
            impeding: activeArmor.impeding,
            defense: attDefValue - activeArmor.impeding + data.data.bonus.defense,
            msg: defMsg
        };
        const activeWeapons = this._getWeapons(data);
        data.data.weapons = [];
        if(activeWeapons.length > 0){
            data.data.weapons = this.evaluateWeapons(activeWeapons);
        }
        let attributeInit = data.data.initiative.attribute.toLowerCase();
        data.data.initiative.value = (data.data.attributes[attributeInit].value * 1000) + (data.data.attributes.vigilant.value * 10);
        
        data.data.experience.spent = data.data.bonus.experience.cost - data.data.bonus.experience.value;
        data.data.experience.available = data.data.experience.total - data.data.experience.artifactrr - data.data.experience.spent;
    }

    _computePower(data, item) {
        let expCost = 0;
        if (item.isRitual) {
            item.data.actions = "Ritual";
            this.data.data.numRituals = this.data.data.numRituals + 1;
            if( this.data.data.numRituals > 6 ) {
            // This needs to check if running with alternative rules for additional rituals, APG p.102                
              expCost = game.settings.get('symbaroum', 'optionalMoreRituals') ? 10 : 0;
            }
        } else if (item.isBurden) {
            item.data.actions = "Burden";
            expCost = -5 * item.data.level;
        } else if (item.isBoon) {
            item.data.actions = "Boon";            
            expCost = 5 * item.data.level;
        } else {
			
            let novice = "-";
            let adept = "-";
            let master = "-";
            if (item.data.novice.isActive) {
              novice = item.data.novice.action;
              expCost += 10;
            }
            if (item.data.adept.isActive) { 
              adept = item.data.adept.action;
              expCost += 20;
            }
            if (item.data.master.isActive) {
              master = item.data.master.action;
              expCost += 30;
            }
            item.data.actions = `${novice}/${adept}/${master}`;
        }
        item.data.bonus.experience.cost = expCost;
        
        this._addBonus(data, item);
    }

    _computeGear(data, item) {
        item.isActive = item.data.state === "active";
        item.isEquipped = item.data.state === "equipped";
        if (item.isActive) {
            this._addBonus(data, item);
        }
    }
    
    evaluateWeapons(activeWeapons) {
        let weaponArray = [];
        // check for abilities that gives bonuses to rolls
        let ironFistLvl = 0;
        let ironFist = this.items.filter(element => element.data.data?.reference === "ironfist");
        if(ironFist.length > 0){
            let powerLvl = getPowerLevel(ironFist[0]);
            ironFistLvl = powerLvl.level;
        }
        let marksmanLvl = 0;
        let marksman = this.items.filter(element => element.data.data?.reference === "marksman");
        if(marksman.length > 0){
            let powerLvl = getPowerLevel(marksman[0]);
            marksmanLvl = powerLvl.level;
        }
        let polearmmasteryLvl = 0;
        let polearmmastery = this.items.filter(element => element.data.data?.reference === "polearmmastery");
        if(polearmmastery.length > 0){
            let powerLvl = getPowerLevel(polearmmastery[0]);
            polearmmasteryLvl = powerLvl.level;
        }
        let shieldfighterLvl = 0;
        let shieldfighter = this.items.filter(element => element.data.data?.reference === "shieldfighter");
        if(shieldfighter.length > 0){
            let haveShieldEquipped = this.items.filter(element => element.data.data?.reference === "shield" && element._data.isActive)
            if(haveShieldEquipped.length > 0){
                let powerLvl = getPowerLevel(shieldfighter[0]);
                shieldfighterLvl = powerLvl.level;
            }
        }
        let twohandedforceLvl = 0;
        let twohandedforce = this.items.filter(element => element.data.data?.reference === "twohandedforce");
        if(twohandedforce.length > 0){
            let powerLvl = getPowerLevel(twohandedforce[0]);
            twohandedforceLvl = powerLvl.level;
        }
        let robustLvl = 0;
        let robust = this.items.filter(element => element.data.data?.reference === "robust");
        if(robust.length > 0){
            let powerLvl = getPowerLevel(robust[0]);
            robustLvl = powerLvl.level;
        }
        let naturalweaponLvl = 0;
        let naturalweapon = this.items.filter(element => element.data.data.reference === "naturalweapon");
        if(naturalweapon.length > 0){
            naturalweaponLvl = getPowerLevel(naturalweapon[0]).level;
        }
        let naturalwarriorLvl = 0;
        let naturalwarrior = this.items.filter(element => element.data.data.reference === "naturalwarrior");
        if(naturalwarrior.length > 0){
            naturalwarriorLvl = getPowerLevel(naturalwarrior[0]).level;
        }
        let flagBerserk = this.getFlag(game.system.id, 'berserker');

        // check for abilities that changes attack attribute
        let dominate = this.items.filter(element => element.data.data?.reference === "dominate");
        let feint = this.items.filter(element => element.data.data?.reference === "feint");
        let knifeplay = this.items.filter(element => element.data.data?.reference === "knifeplay");
        let sixthsense = this.items.filter(element => element.data.data?.reference === "sixthsense");
        let tacticianLvl = 0;
        let tactician = this.items.filter(element => element.data.data?.reference === "tactician");
        if(tactician.length > 0){
            tacticianLvl = getPowerLevel(tactician[0]).level;
        }

        for(let item of activeWeapons){
            let attribute = item.data.data.attribute;
            let tooltip = "";
            let baseDamage = item.data.data.baseDamage;
            let bonusDamage = "";
            if(item.data.data.bonusDamage != ""){
                bonusDamage = "+" + item.data.data.bonusDamage;
            }
            if(item.data.data?.isMelee){
                if(ironFistLvl == 2){
                    bonusDamage += "+1d4["+game.i18n.localize("ABILITY_LABEL.IRON_FIST")+"]";
                    tooltip += game.i18n.localize("ABILITY_LABEL.IRON_FIST") + ironFistLvl.toString() + ", ";
                }
                else if(ironFistLvl > 2){
                    bonusDamage += "+1d8["+game.i18n.localize("ABILITY_LABEL.IRON_FIST")+"]";
                    tooltip += game.i18n.localize("ABILITY_LABEL.IRON_FIST") + ironFistLvl.toString() + ", ";
                }
                if(polearmmasteryLvl > 0 && item.data.data.qualities.long){
                    let newdamage = upgradeDice(baseDamage, 1);
                    baseDamage = newdamage;
                    tooltip += game.i18n.localize("ABILITY_LABEL.POLEARM_MASTERY") + ", ";
                }
                if(shieldfighterLvl > 0){
                    if(["1handed", "short", "unarmed"].includes(item.data.data.reference)){
                        let newdamage = upgradeDice(baseDamage, 1);
                        baseDamage = newdamage;
                        tooltip += game.i18n.localize("ABILITY_LABEL.SHIELD_FIGHTER") + ", ";
                    }
                    else if(item.data.data.reference === "shield"){
                        if(shieldfighterLvl > 2){
                            let newdamage = upgradeDice(baseDamage, 2);
                            baseDamage = newdamage;
                        }
                    }
                }
                if(robustLvl == 1){
                    bonusDamage += "+1d4["+game.i18n.localize("TRAIT_LABEL.ROBUST")+"]";
                    tooltip += game.i18n.localize("TRAIT_LABEL.ROBUST") + robustLvl.toString() + ", ";
                }
                else if(robustLvl == 2){
                    bonusDamage += "+1d6["+game.i18n.localize("TRAIT_LABEL.ROBUST")+"]";
                    tooltip += game.i18n.localize("TRAIT_LABEL.ROBUST") + robustLvl.toString() + ", ";
                }
                else if(robustLvl > 2){
                    bonusDamage += "+1d8["+game.i18n.localize("TRAIT_LABEL.ROBUST")+"]";
                    tooltip += game.i18n.localize("TRAIT_LABEL.ROBUST") + robustLvl.toString() + ", ";
                }
                if(flagBerserk){
                    bonusDamage += "+1d6["+game.i18n.localize("ABILITY_LABEL.BERSERKER")+"]";
                    tooltip += game.i18n.localize("ABILITY_LABEL.BERSERKER") + ", ";
                }
                if(ironFistLvl > 0){
                    if(this.data.data.attributes.strong.total > this.data.data.attributes[attribute].total){
                        attribute = "strong"
                    }
                }
                if(dominate.length > 0){
                    if(this.data.data.attributes.persuasive.total > this.data.data.attributes[attribute].total){
                        attribute = "persuasive"
                    }
                }
                if(feint.length > 0 && (item.data.data.qualities.precise || item.data.data.qualities.short)){
                    if(this.data.data.attributes.discreet.total > this.data.data.attributes[attribute].total){
                        attribute = "discreet"
                    }
                }
                if(knifeplay.length > 0 && item.data.data.qualities.short){
                    if(this.data.data.attributes.quick.total > this.data.data.attributes[attribute].total){
                        attribute = "quick"
                    }
                }
            }
            if(tacticianLvl > 2 && item.data.data.reference != "heavy"){
                if(this.data.data.attributes.cunning.total > this.data.data.attributes[attribute].total){
                    attribute = "cunning"
                }
            }
            
            if(item.data.data?.isDistance){
                if(sixthsense.length > 0){
                    if(this.data.data.attributes.vigilant.total > this.data.data.attributes[attribute].total){
                        attribute = "vigilant"
                    }
                }
                if(item.data.data.reference === "thrown"){
                    let steelthrow = this.items.filter(element => element.data.data.reference === "steelthrow");
                    if(steelthrow.length > 0){
                        let newdamage = upgradeDice(baseDamage, 1);
                        baseDamage = newdamage;
                        tooltip += game.i18n.localize("ABILITY_LABEL.STEEL_THROW") + ", ";
                    }
                }
                if(item.data.data.reference === "ranged"){
                    if(marksmanLvl > 0){
                        let newdamage = upgradeDice(baseDamage, 1);
                        baseDamage = newdamage;
                        tooltip += game.i18n.localize("ABILITY_LABEL.MARKSMAN") + ", ";
                    }
                }
            }
            if(item.data.data.reference === "heavy"){
                if(twohandedforceLvl > 0){
                    let newdamage = upgradeDice(baseDamage, 1);
                    baseDamage = newdamage;
                    tooltip += game.i18n.localize("ABILITY_LABEL.2HANDED_FORCE") + ", ";
                }
            }
            if(item.data.data.reference === "unarmed"){
                if(naturalweaponLvl > 0){
                    let newdamage = upgradeDice(baseDamage, naturalweaponLvl);
                    baseDamage = newdamage;
                    tooltip += game.i18n.localize("TRAIT_LABEL.NATURALWEAPON") + naturalweaponLvl.toString() + ", ";
                }
                if(naturalwarriorLvl > 0){
                    let newdamage = upgradeDice(baseDamage, 1);
                    baseDamage = newdamage;
                    tooltip += game.i18n.localize("ABILITY_LABEL.NATURAL_WARRIOR") + naturalwarriorLvl.toString() + ", ";
                }
                if(naturalwarriorLvl > 2){
                    bonusDamage += "+1d6["+game.i18n.localize("ABILITY_LABEL.NATURAL_WARRIOR")+"]";
                }
            }
            let pcDamage = baseDamage + bonusDamage;
            let DmgRoll= new Roll(pcDamage).evaluate({maximize: true});
            let npcDamage = Math.ceil(DmgRoll.total/2);         
            if(item.data.data.qualities.deepImpact){
                pcDamage += "+1";
                npcDamage+= 1;
                tooltip += game.i18n.localize("QUALITY.DEEPIMPACT") + ", ";
            }
            let itemID = item.data._id;
            weaponArray.push({
                _id: itemID,
                name : item.data.name,
                img: item.data.img,
                attribute: attribute,
                attributeLabel: this.data.data.attributes[attribute].label, 
                tooltip : tooltip,
                isActive: item._data.isActive,
                isEquipped: item._data.isEquipped,
                reference: item.data.data.reference, 
                isMelee: item.data.data.isMelee, 
                isDistance: item.data.data.isDistance,
                qualities: item.data.data.qualities,
                damage: {
                    base: baseDamage, 
                    bonus: bonusDamage, 
                    pc: pcDamage, 
                    npc: npcDamage
                }
            })
        }
        return(weaponArray)
    }
    
    _evaluateProtection(item) {
        let tooltip = "";
        let protection = item.data.data.baseProtection;
        let impeding = item.data.data.impeding;
        let bonusProtection = "";
        if(item.data.data.bonusProtection != ""){
            bonusProtection = "+" + item.data.data.bonusProtection;
        }
        let manatarms = this.items.filter(element => element.data.data?.reference === "manatarms");
        if(manatarms.length > 0){
            let powerLvl = getPowerLevel(manatarms[0]);
            let newprot = upgradeDice(protection, 1);
            protection = newprot;
            tooltip += game.i18n.localize("ABILITY_LABEL.MAN_AT_ARMS") + ", ";
            if(powerLvl.level > 1){
                impeding = 0;
            }
        }
        let naturalarmor = this.items.filter(element => element.data.data?.reference === "armored");
        if(naturalarmor.length > 0){
            let powerLvl = getPowerLevel(naturalarmor[0]);
            let newprot = upgradeDice(protection, powerLvl.level -1);
            protection = newprot;
            tooltip += game.i18n.localize("TRAIT_LABEL.ARMORED") + powerLvl.lvlName + ", ";
        }
        let robust = this.items.filter(element => element.data.data?.reference === "robust");
        if(robust.length > 0){
            let powerLvl = getPowerLevel(robust[0]);
            if(powerLvl.level == 2){
                bonusProtection += "+1d6";
            }
            else if(powerLvl.level > 2){
                bonusProtection += "+1d8";
            }
            else{
                bonusProtection += "+1d4";
            }
            tooltip += game.i18n.localize("TRAIT_LABEL.ROBUST") + powerLvl.lvlName + ", ";
        }
        let flagBerserk = this.getFlag(game.system.id, 'berserker');
        if(flagBerserk && flagBerserk > 1){
            bonusProtection += "+1d4";
            tooltip += game.i18n.localize("ABILITY_LABEL.BERSERKER") + ", ";
        }
        let pcProt = protection + bonusProtection;
        let armorRoll= new Roll(pcProt).evaluate({maximize: true});
        let npcProt = Math.ceil(armorRoll.total/2);
        
        if(item.data.data?.qualities?.reinforced){
            pcProt += "+1";
            npcProt+= 1;
        }
        return({
            _id: item.data._id,
            name: item.data.name,
            base: protection,
            bonus: bonusProtection, 
            pc: pcProt, 
            npc: npcProt,
            tooltip: tooltip,
            impeding: impeding,
            isActive: item._data.isActive, 
            isEquipped: item._data.isEquipped, 
            img: item.data.img})
    }

    _getActiveArmor(data) {
        let wearArmor;
        data.data.armors = [];
        let armorList = this.items.filter(element => element._data.isArmor);
        for(let armor of armorList){
            let armorData = this._evaluateProtection(armor);
            data.data.armors.push(armorData);
            if(armorData.isActive){
                wearArmor = armorData;
            }
        }
        if(typeof wearArmor == 'undefined'){
            let noArmor = this._evaluateProtection({
                data: {
                    _id: null,
                    name: "No Armor",
                    img:"icons/equipment/chest/shirt-simple-white.webp",
                    data: {
                        baseProtection: "0",
                        bonusProtection: "",
                        impeding: 0,
                        qualities: {
                            flexible: false,
                            cumbersome: false,
                            concealed: false,
                            reinforced: false,
                            hallowed: false,
                            retributive: false,
                            desecrated: false
                        }
                    }
                },
                _data: {
                    isActive: true, 
                    isEquipped: false
                }
            })
            data.data.armors.push(noArmor);
            wearArmor = noArmor
        }
        return(wearArmor)
    }

    _getWeapons(data) {
        let weaponArray = this.items.filter(element => element._data.isWeapon);
        return(weaponArray)
    }

    _addBonusData(currentb, item, itemb, bonusType) {
      if(itemb[bonusType] != 0 ) {
        currentb[bonusType] += itemb[bonusType];
        currentb[bonusType+"_msg"] += "<br />"+item.name+"("+itemb[bonusType]+")";
      }
    }

    _addBonus(data, item) {
      let currentBonus = data.data.bonus;
      let currentBonusToughness = currentBonus.toughness;
      let currentBonusCorruption = currentBonus.corruption;
      let currentBonusExperience = currentBonus.experience;
      let itemBonus = item.data.bonus;
      let itemBonusToughness = itemBonus.toughness;
      let itemtBonusCorruption = itemBonus.corruption;
      let itemBonusExperience = itemBonus.experience;
      
      this._addBonusData(currentBonus, item, itemBonus, "defense");
      this._addBonusData(currentBonus, item, itemBonus, "accurate");
      this._addBonusData(currentBonus, item, itemBonus, "cunning");
      this._addBonusData(currentBonus, item, itemBonus, "discreet");
      this._addBonusData(currentBonus, item, itemBonus, "persuasive");
      this._addBonusData(currentBonus, item, itemBonus, "quick");
      this._addBonusData(currentBonus, item, itemBonus, "resolute");
      this._addBonusData(currentBonus, item, itemBonus, "strong");
      this._addBonusData(currentBonus, item, itemBonus, "vigilant");
      
      this._addBonusData(currentBonusToughness, item, itemBonusToughness, "max");
      this._addBonusData(currentBonusToughness, item, itemBonusToughness, "threshold");
      this._addBonusData(currentBonusCorruption, item, itemtBonusCorruption, "max");
      this._addBonusData(currentBonusCorruption, item, itemtBonusCorruption, "threshold");
      this._addBonusData(currentBonusExperience, item, itemBonusExperience, "cost");
      this._addBonusData(currentBonusExperience, item, itemBonusExperience, "value");

    }
    


    async usePower(powerItem){
       await powerItem.makeAction(this);
    }

    async rollArmor() {
        if(!game.settings.get('symbaroum', 'combatAutomation')){
            const armor = this.data.data.combat;
            await prepareRollAttribute(this, "defense", armor, null)
        }
    }

    async rollWeapon(weapon){
        if(game.settings.get('symbaroum', 'combatAutomation')){
            await attackRoll(weapon, this);
        }
        else{
            await prepareRollAttribute(this, weapon.attribute, null, weapon)
        }
    }

    async rollAttribute(attributeName) {
        await prepareRollAttribute(this, attributeName, null, null);
    }
}
