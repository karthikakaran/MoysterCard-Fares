import { describe, test, expect } from "@jest/globals";
import FareCalculation from "../src/FareCalcution";
import * as inputFile1 from "./data/listJourney.json";
import * as inputFile2 from "./data/listJourney_cap.json";
import * as inputFile3 from "./data/listJourney_peek_hr.json";
import * as inputFile4 from "./data/listJourney_invalid_inp1.json";
import * as inputFile5 from "./data/listJourney_cap_zone1.json";
import * as inputFile6 from "./data/listJourney_cap_zone2.json";
import * as inputFile7 from "./data/listJourney_next_yr_zone1.json";
import * as inputFile8 from "./data/listJourney_invalid_inp2.json";

describe("Daily Fare Calculations", () => {
  const fareCalc = new FareCalculation();

  test("Normal fare or below limit", () => {
    let fareMap = fareCalc.calculateFares(inputFile1);
    expect(fareMap[0].date).toEqual("Tue Jul 29 2025 16:50:00");
    expect(fareMap[0].fare).toEqual(30);
  });

  test("Reached daily cap farthest zone 1-2", () => {
    let fareMap = fareCalc.calculateFares(inputFile2);
    expect(fareMap[3].date).toEqual("Mon Jul 28 2025 10:00:00");
    // For a 1-2 zone peek hour 10:00:00 weekday, due to cap limit fare becomes 20 instead of 35
    expect(fareMap[3].fare).toEqual(20);
  });

  test("Reached daily cap same zone 1-1", () => {
    let fareMap = fareCalc.calculateFares(inputFile2);
    expect(fareMap[8].date).toEqual("Tue Jul 29 2025 19:00:00");
    // For a 1-1 zone peek hour 19:00:00 weekday, due to cap limit fare becomes 0 instead of 30
    expect(fareMap[8].fare).toEqual(0);
  });

  test("Reached daily cap same zone 2-2", () => {
    let fareMap = fareCalc.calculateFares(inputFile1);
    expect(fareMap[11].date).toEqual("Thu Jul 31 2025 21:00:00");
    expect(fareMap[11].fare).toEqual(10);
  });

  test("Morning peek hour", () => {
    let fareMap = fareCalc.calculateFares(inputFile3);
    expect(fareMap[0].date).toEqual("Tue Jul 29 2025 10:00:00");
    expect(fareMap[0].fare).toEqual(30); // 1-1
  });

  test("Evening peek hour", () => {
    let fareMap = fareCalc.calculateFares(inputFile3);
    expect(fareMap[1].date).toEqual("Wed Jul 30 2025 19:50:00");
    expect(fareMap[1].fare).toEqual(25); // 2-2
  });

  test("Morning off-peek hour", () => {
    let fareMap = fareCalc.calculateFares(inputFile3);
    expect(fareMap[2].date).toEqual("Thu Jul 31 2025 10:33:00"); //10:33 which is 3 minutes past peek hour 10:30
    expect(fareMap[2].fare).toEqual(20); // 2-2
  });

  test("Evening off-peek hour", () => {
    let fareMap = fareCalc.calculateFares(inputFile3);
    expect(fareMap[3].date).toEqual("Fri Aug 01 2025 10:33:00");
    expect(fareMap[3].fare).toEqual(25); // 1-1
  });

  test("Invalid date input", () => {
    let error = fareCalc.calculateFares(inputFile4);
    expect(error).not.toHaveProperty("date");
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("message");
  });

  test("Invalid zone number input", () => {
    let error = fareCalc.calculateFares(inputFile8);
    expect(error).not.toHaveProperty("date");
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("message");
  });
});

describe("Weekly Fare Calculations", () => {
  const fareCalc = new FareCalculation();
  // This also tests "Weekly cap applied prior to daily cap"
  test("Weekly cap reached zone 1", () => {
    let fareMap = fareCalc.calculateFares(inputFile5);
    expect(fareMap[21].date).toEqual("Sat Aug 02 2025 20:00:00");
    expect(fareMap[21].fare).toEqual(10);
    expect(fareMap[22].date).toEqual("Sat Aug 02 2025 08:20:00");
    expect(fareMap[22].fare).toEqual(0);
  });

  // This also tests "Weekly cap applied prior to daily cap"
  test("Weekly cap reached zone 2", () => {
    let fareMap = fareCalc.calculateFares(inputFile6);
    expect(fareMap[21].date).toEqual("Sun Aug 03 2025 08:20:00");
    expect(fareMap[21].fare).toEqual(5);
  });

  test("Weekly cap reached but day falls in next year", () => {
    let fareMap = fareCalc.calculateFares(inputFile7);
    expect(fareMap[19].date).toEqual("Fri Jan 03 2025 20:00:00");
    expect(fareMap[19].fare).toEqual(30);
    expect(fareMap[20].date).toEqual("Sat Jan 04 2025 09:00:00");
    expect(fareMap[20].fare).toEqual(0);
  });

  test("Weekly cap reached farthest zone 1-2", () => {
    let fareMap = fareCalc.calculateFares(inputFile2);
    expect(fareMap[20].date).toEqual("Sat Aug 02 2025 19:20:00");
    expect(fareMap[20].fare).toEqual(35);
    expect(fareMap[21].date).toEqual("Sat Aug 02 2025 20:00:00");
    expect(fareMap[21].fare).toEqual(0);
  });

  test("Second weekly cap after previous week reaching cap", () => {
    let fareMap = fareCalc.calculateFares(inputFile2);
    expect(fareMap[25].date).toEqual("Sun Aug 03 2025 09:00:00");
    expect(fareMap[25].fare).toEqual(0);
    expect(fareMap[26].date).toEqual("Mon Aug 04 2025 08:20:00");
    expect(fareMap[26].fare).toEqual(30);
  });

  test("Weekend peek hour", () => {
    let fareMap = fareCalc.calculateFares(inputFile3);
    expect(fareMap[4].date).toEqual("Sat Aug 02 2025 10:59:00");
    expect(fareMap[4].fare).toEqual(35); // 1-2
  });

  test("Weekend off-peek hour", () => {
    let fareMap = fareCalc.calculateFares(inputFile3);
    expect(fareMap[5].date).toEqual("Sun Aug 03 2025 15:15:00");
    expect(fareMap[5].fare).toEqual(25); // 1-1
  });
});
