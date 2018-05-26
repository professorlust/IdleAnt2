import { Injectable } from "@angular/core";
import { FullUnit } from "./full-unit";
import { Production } from "./production";
import { UnitGroup } from "./unit-group";
import { Materials } from "./units/materials";
import { BaseUnit } from "./baseUnit";
import { Utility } from "./utility";

@Injectable({
  providedIn: "root"
})
export class GameService {
  units = new Array<BaseUnit>();
  unlockedUnits = new Array<FullUnit>();

  unitGroups = new Array<UnitGroup>();
  unlockedGroups = new Array<UnitGroup>();
  //#region UnitGroups
  materials: Materials;
  //#endregion

  constructor() {
    this.materials = new Materials();
    this.unitGroups.push(this.materials);

    this.unitGroups.forEach(g => g.declareStuff());
    this.unitGroups.forEach(g => g.setRelations());

    this.materials.list.forEach(u => (u.unlocked = true));

    this.unitGroups.forEach(g => g.check(true));
    this.unitGroups
      .map(g => g.list)
      .forEach(l => l.forEach(u => this.units.push(u)));
    this.check();
  }
  check() {
    this.units.forEach(u => {
      if (u instanceof FullUnit && u.unlocked) this.unlockedUnits.push(u);
    });
    this.unlockedGroups = this.unitGroups.filter(g => g.unlocked.length > 0);
  }

  update(time: number) {
    let maxTime = time;
    let unitZero: FullUnit = null;

    for (const unit of this.unlockedUnits) {
      unit.a = new Decimal(0);
      unit.b = new Decimal(0);
      unit.c = new Decimal(0);
      const d = unit.quantity;

      for (const prod1 of unit.producedBy.filter(p => p.prductor.isActive())) {
        // x
        const prodX = prod1.rateo;
        unit.c = unit.c.plus(prodX.times(prod1.prductor.quantity));

        for (const prod2 of prod1.prductor.producedBy.filter(p =>
          p.prductor.isActive()
        )) {
          // x^2
          const prodX2 = prod2.rateo.times(prodX);
          unit.b = unit.b.plus(prodX2.times(prod2.prductor.quantity));

          for (const prod3 of prod2.prductor.producedBy.filter(p =>
            p.prductor.isActive()
          )) {
            // x^3
            const prodX3 = prod3.rateo.times(prodX2);
            unit.a = unit.a.plus(prodX3.times(prod3.prductor.quantity));
          }
        }
      }
      unit.a = unit.a.div(6);
      unit.b = unit.b.div(2);

      if (unit.a.lt(0) || unit.b.lt(0) || unit.c.lt(0) || d.lt(0)) {
        const solution = Utility.solveCubic(unit.a, unit.b, unit.c, d).filter(
          s => s.gt(0)
        );

        if (solution.length > 0) {
          const min = solution.reduce(
            (p, c) => p.min(c),
            new Decimal(Number.POSITIVE_INFINITY)
          );
          if (maxTime > min.toNumber() * 1000) {
            maxTime = min.toNumber() * 1000;
            unitZero = unit;
          }
          unit.endIn = Math.min(min.times(1000).toNumber(), unit.endIn);
        }
      }
    }

    this.unlockedUnits
      .filter(u => u.endIn > 0)
      .forEach(u => (u.endIn = u.endIn - maxTime));

    if (maxTime > Number.EPSILON) this.update2(new Decimal(maxTime).div(1000));

    if (unitZero)
      unitZero.producedBy
        .filter(p => p.rateo.lt(0))
        .forEach(p => (p.prductor.efficiency = 0));

    const remaning = time - maxTime;
    if (remaning > Number.EPSILON) {
      // this.reloadProduction();
      this.update(remaning);
    }
  }

  update2(dif: Decimal) {
    this.unlockedUnits.forEach(u => {
      u.quantity = u.quantity
        .plus(u.a.times(Decimal.pow(dif, 3)))
        .plus(u.b.times(Decimal.pow(dif, 2)))
        .plus(u.c.times(dif));
    });
  }

  //#region Save and Load
  getSave(): any {
    return {
      u: this.units.map(u => u.getSave())
    };
  }
  restore(data: any): boolean {
    if ("u" in data) {
      for (const s of data.u) this.units.find(u => u.id === s.i).restore(s);
      return true;
    } else {
      return false;
    }
  }
  //#endregion
}